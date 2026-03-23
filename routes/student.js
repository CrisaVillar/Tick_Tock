
const express = require('express');
const router = express.Router();
const client = require('../conn');

function showMessage(req) {
  const message = req.session.message;
  delete req.session.message;
  return message;
}

// --- Dashboard ---
router.get('/dashboard', async (req, res) => {
  if (!req.session.student) return res.redirect('/auth/login');
  const studId = req.session.student.student_id;

  try {
    const totalTasks = await client.query('SELECT COUNT(*) AS total FROM tasks WHERE student_id = $1', [studId]);
    const completedTasks = await client.query('SELECT COUNT(*) AS completed FROM tasks WHERE student_id = $1 AND status = $2', [studId, 'Done']);
    const priorityRes = await client.query(`
      SELECT
        SUM(CASE WHEN priority='High' THEN 1 ELSE 0 END) AS high,
        SUM(CASE WHEN priority='Medium' THEN 1 ELSE 0 END) AS medium,
        SUM(CASE WHEN priority='Low' THEN 1 ELSE 0 END) AS low
      FROM tasks
      WHERE student_id=$1
    `, [studId]);
    const studySessRes = await client.query('SELECT COUNT(*) AS total_session FROM study_sessions WHERE student_id=$1', [studId]);
    const studyTimeRes = await client.query('SELECT COALESCE(SUM(duration_minutes),0) AS total_minutes FROM study_sessions WHERE student_id=$1', [studId]);
    const subjectRes = await client.query('SELECT subject, SUM(duration_minutes) AS total_minutes FROM study_sessions WHERE student_id=$1 GROUP BY subject', [studId]);
    const recentRes = await client.query('SELECT subject, duration_minutes, start_time FROM study_sessions WHERE student_id=$1 ORDER BY start_time DESC LIMIT 5', [studId]);

    const total = totalTasks.rows[0].total;
    const completed = completedTasks.rows[0].completed;
    const pending = total - completed;
    const totalSession = studySessRes.rows[0].total_session;
    const totalMinutes = studyTimeRes.rows[0].total_minutes;
    const totalHours = (totalMinutes / 60).toFixed(1);

    const priorityStat = {
      high: priorityRes.rows[0].high || 0,
      medium: priorityRes.rows[0].medium || 0,
      low: priorityRes.rows[0].low || 0
    };

    res.render('dashboard', {
      student: req.session.student,
      totalTasks: total,
      completedTasks: completed,
      pendingTasks: pending,
      totalSession,
      totalStudyHours: totalHours,
      priorityStat,
      studyBySubject: subjectRes.rows,
      recentSessions: recentRes.rows,
      message: showMessage(req)
    });

  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Failed to load dashboard.' };
    res.redirect('/auth/login');
  }
});

// --- Daily Planner ---
router.get('/daily-planner', async (req, res) => {
  if (!req.session.student) return res.redirect('/auth/login');
  const studId = req.session.student.student_id;

  try {
    const plan = await client.query('SELECT * FROM tasks WHERE student_id=$1 ORDER BY start_time ASC', [studId]);
    res.render('daily-planner', {
      student: req.session.student,
      tasks: plan.rows,
      message: showMessage(req)
    });
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Failed to load tasks.' };
    res.redirect('/student/dashboard');
  }
});

// --- Add Task ---
router.get('/add-task', (req, res) => {
  if (!req.session.student) return res.redirect('/auth/login');
  res.render('add-tasks', { student: req.session.student, message: showMessage(req) });
});

router.post('/add-task', async (req, res) => {
  if (!req.session.student) return res.redirect('/auth/login');
  const { title, description, subject, start_time, end_time, priority } = req.body;
  const studId = req.session.student.student_id;

  try {
    await client.query(
      `INSERT INTO tasks (student_id, title, description, subject, start_time, end_time, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [studId, title, description, subject, start_time || null, end_time || null, priority]
    );
    req.session.message = { type: 'success', text: 'Task added successfully!' };
    res.redirect('/student/daily-planner');
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Failed to add task.' };
    res.redirect('/student/daily-planner');
  }
});

// --- Update Task Status ---
router.post('/update-status/:task_id', async (req, res) => {
  if (!req.session.student) return res.redirect('/auth/login');
  const taskId = req.params.task_id;
  const newStatus = req.body.status === 'Done' ? 'Done' : 'Pending';

  try {
    await client.query('UPDATE tasks SET status=$1 WHERE task_id=$2', [newStatus, taskId]);
    req.session.message = { type: 'success', text: `Task marked as ${newStatus}.` };
    res.redirect('/student/daily-planner');
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Failed to update task.' };
    res.redirect('/student/daily-planner');
  }
});

// --- Edit Task ---
router.get('/edit-task/:task_id', async (req, res) => {
  if (!req.session.student) return res.redirect('/auth/login');
  const taskId = req.params.task_id;

  try {
    const taskRes = await client.query('SELECT * FROM tasks WHERE task_id=$1', [taskId]);
    if (taskRes.rows.length === 0) return res.send('Task not found!');
    res.render('edit-task', { student: req.session.student, task: taskRes.rows[0], message: showMessage(req) });
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Failed to fetch task.' };
    res.redirect('/student/daily-planner');
  }
});

router.post('/edit-task/:task_id', async (req, res) => {
  const taskId = req.params.task_id;
  const { title, description, subject, start_time, end_time, priority } = req.body;

  try {
    await client.query(
      `UPDATE tasks SET title=$1, description=$2, subject=$3, start_time=$4, end_time=$5, priority=$6 WHERE task_id=$7`,
      [title, description, subject, start_time || null, end_time || null, priority, taskId]
    );
    req.session.message = { type: 'success', text: 'Task updated successfully!' };
    res.redirect('/student/daily-planner');
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Error updating task.' };
    res.redirect('/student/daily-planner');
  }
});

// --- Delete Task ---
router.post('/delete-task/:task_id', async (req, res) => {
  if (!req.session.student) return res.redirect('/auth/login');
  const taskId = req.params.task_id;

  try {
    await client.query('DELETE FROM tasks WHERE task_id=$1', [taskId]);
    req.session.message = { type: 'success', text: 'Task deleted successfully!' };
    res.redirect('/student/daily-planner');
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Error deleting task.' };
    res.redirect('/student/daily-planner');
  }
});

// --- Study Tracker ---
router.get('/study-tracker', async (req, res) => {
  if (!req.session.student) return res.redirect('/auth/login');
  const studId = req.session.student.student_id;

  try {
    const sessions = await client.query('SELECT * FROM study_sessions WHERE student_id=$1 ORDER BY start_time DESC', [studId]);
    res.render('study-tracker', { student: req.session.student, sessions: sessions.rows, message: showMessage(req) });
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Failed to load study sessions.' };
    res.redirect('/student/dashboard');
  }
});

// --- Log New Study Session ---
router.get('/log-session', (req, res) => {
  if (!req.session.student) return res.redirect('/auth/login');
  res.render('log-session', { student: req.session.student, message: showMessage(req) });
});

router.post('/log-session', async (req, res) => {
  if (!req.session.student) return res.redirect('/auth/login');
  const { subject, description, start_time, duration_minutes } = req.body;
  const studId = req.session.student.student_id;

  try {
    await client.query(
      `INSERT INTO study_sessions (student_id, subject, description, start_time, duration_minutes)
       VALUES ($1, $2, $3, $4, $5)`,
      [studId, subject, description, start_time || null, duration_minutes || 0]
    );
    req.session.message = { type: 'success', text: 'Study session logged successfully!' };
    res.redirect('/student/study-tracker');
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Error logging study session.' };
    res.redirect('/student/study-tracker');
  }
});

// --- Delete Study Session ---
router.post('/delete-session/:study_id', async (req, res) => {
  if (!req.session.student) return res.redirect('/auth/login');
  const studyId = req.params.study_id;

  try {
    await client.query('DELETE FROM study_sessions WHERE study_id=$1', [studyId]);
    req.session.message = { type: 'success', text: 'Study session deleted successfully!' };
    res.redirect('/student/study-tracker');
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Error deleting study session.' };
    res.redirect('/student/study-tracker');
  }
});

// --- View Profile ---
router.get('/profile', async (req, res) => {
  if (!req.session.student) return res.redirect('/auth/login');
  const studId = req.session.student.student_id;

  try {
    const userRes = await client.query('SELECT name, email, course, year_level FROM students WHERE student_id=$1', [studId]);
    if (userRes.rows.length === 0) {
      req.session.message = { type: 'danger', text: 'Profile not found.' };
      return res.redirect('/student/dashboard');
    }
    res.render('profile', { student: req.session.student, user: userRes.rows[0], message: showMessage(req) });
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Failed to load profile.' };
    res.redirect('/student/dashboard');
  }
});

// --- Update Profile ---
router.post('/update-profile', async (req, res) => {
  if (!req.session.student) return res.redirect('/auth/login');
  const studId = req.session.student.student_id;
  const { name, course, year_level } = req.body;

  try {
    await client.query('UPDATE students SET name=$1, course=$2, year_level=$3 WHERE student_id=$4', [name, course, year_level, studId]);

    req.session.student.name = name;
    req.session.student.course = course;
    req.session.student.year_level = year_level;

    req.session.message = { type: 'success', text: 'Profile updated successfully!' };
    res.redirect('/student/profile');
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Failed to update profile.' };
    res.redirect('/student/profile');
  }
});

module.exports = router;
