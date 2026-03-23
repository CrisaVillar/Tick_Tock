// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const client = require('../conn');

// Register
router.get('/register', (req, res) => {
  const message = req.session.message;
  req.session.message = null;
  res.render('register', { message });
});

router.post('/register', async (req, res) => {
  const { name, email, password, course, year_level } = req.body;
  const hashedPass = await bcrypt.hash(password, 10);

  try {
    await client.query(
      'INSERT INTO students (name, email, password, course, year_level) VALUES ($1,$2,$3,$4,$5)',
      [name, email, hashedPass, course, year_level]
    );
    req.session.message = { type: 'success', text: 'Account created successfully!' };
    res.redirect('/auth/login');
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Email might already exist or invalid input.' };
    res.redirect('/auth/register');
  }
});

// Login
router.get('/login', (req, res) => {
  const message = req.session.message;
  req.session.message = null;
  res.render('login', { message });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await client.query('SELECT * FROM students WHERE email=$1', [email]);
    if (result.rows.length === 0) {
      req.session.message = { type: 'danger', text: 'No student found with that email' };
      return res.redirect('/auth/login');
    }
    const student = result.rows[0];
    const match = await bcrypt.compare(password, student.password);
    if (!match) {
      req.session.message = { type: 'danger', text: 'Incorrect password' };
      return res.redirect('/auth/login');
    }
    req.session.student = student;
    req.session.message = { type: 'success', text: 'Login successful!' };
    res.redirect('/student/dashboard');
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Login failed' };
    res.redirect('/auth/login');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
