const express = require('express');
const router = express.Router();
const pool = require('../conn');

function showMessage(req) {
  const message = req.session.message;
  delete req.session.message;
  return message;
}

// -------------------- DASHBOARD --------------------
router.get('/dashboard', async (req, res) => {
  if (!req.session.student) return res.redirect('/auth/login');

  const studId = req.session.student.student_id;

  try {
    const totalTasksRes = await pool.query('SELECT COUNT(*) AS total FROM tasks WHERE student_id = $1', [studId]);
    const completedTasksRes = await pool.query('SELECT COUNT(*) AS completed FROM tasks WHERE student_id = $1 AND status = $2', [studId, 'Done']);
    const priorityRes = await pool.query(`
      SELECT
        SUM(CASE WHEN priority='High' THEN 1 ELSE 0 END) AS high,
        SUM(CASE WHEN priority='Medium' THEN 1 ELSE 0 END) AS medium,
        SUM(CASE WHEN priority='Low' THEN 1 ELSE 0 END) AS low
      FROM tasks WHERE student_id=$1
    `, [studId]);
    const studySessRes = await pool.query('SELECT COUNT(*) AS total_session FROM study_sessions WHERE student_id = $1', [studId]);
    const studyTimeRes = await pool.query('SELECT COALESCE(SUM(duration_minutes),0) AS total_minutes FROM study_sessions WHERE student_id = $1', [studId]);
    const subjectRes = await pool.query('SELECT subject, SUM(duration_minutes) AS total_minutes FROM study_sessions WHERE student_id=$1 GROUP BY subject', [studId]);
    const recentRes = await pool.query('SELECT subject, duration_minutes, start_time FROM study_sessions WHERE student_id=$1 ORDER BY start_time DESC LIMIT 5', [studId]);

    const totalTasks = parseInt(totalTasksRes.rows[0].total);
    const completedTasks = parseInt(completedTasksRes.rows[0].completed);
    const pendingTasks = totalTasks - completedTasks;
    const totalSession = parseInt(studySessRes.rows[0].total_session);
    const totalStudyMinutes = parseInt(studyTimeRes.rows[0].total_minutes);
    const totalStudyHours = (totalStudyMinutes / 60).toFixed(1);

    const priorityStat = {
      high: parseInt(priorityRes.rows[0].high) || 0,
      medium: parseInt(priorityRes.rows[0].medium) || 0,
      low: parseInt(priorityRes.rows[0].low) || 0
    };

    res.render('dashboard', {
      student: req.session.student,
      totalTasks,
      completedTasks,
      pendingTasks,
      totalSession,
      totalStudyHours,
      priorityStat,
      studyBySubject: subjectRes.rows,
      recentSessions: recentRes.rows,
      message: showMessage(req)
    });

  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Error loading dashboard.' };
    res.redirect('/');
  }
});

// -------------------- DAILY PLANNER --------------------
router.get('/daily-planner', async (req, res) => {
  if (!req.session.student) return res.redirect('/auth/login');

  try {
    const result = await pool.query('SELECT * FROM tasks WHERE student_id=$1 ORDER BY start_time ASC', [req.session.student.student_id]);
    res.render('daily-planner', { student: req.session.student, tasks: result.rows, message: showMessage(req) });
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Error loading tasks.' };
    res.redirect('/student/dashboard');
  }
});

// -------------------- ADD TASK --------------------
router.get('/add-task', (req, res) => {
  if (!req.session.student) return res.redirect('/auth/login');
  res.render('add-tasks', { student: req.session.student, message: showMessage(req) });
});

router.post('/add-task', async (req, res) => {
  if (!req.session.student) return res.redirect('/auth/login');
  const { title, description, subject, start_time, end_time, priority } = req.body;

  try {
    await pool.query(`
      INSERT INTO tasks (student_id, title, description, subject, start_time, end_time, priority)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [req.session.student.student_id, title, description, subject, start_time, end_time, priority]);

    req.session.message = { type: 'success', text: 'Task added successfully!' };
    res.redirect('/student/daily-planner');
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Failed to add task.' };
    res.redirect('/student/daily-planner');
  }
});

// -------------------- UPDATE TASK STATUS --------------------
router.post('/update-status/:task_id', async (req, res) => {
  if (!req.session.student) return res.redirect('/auth/login');

  const taskId = req.params.task_id;
  const newStatus = req.body.status === 'Done' ? 'Done' : 'Pending';

  try {
    await pool.query('UPDATE tasks SET status=$1 WHERE task_id=$2', [newStatus, taskId]);
    req.session.message = { type: 'success', text: `Task marked as ${newStatus}.` };
    res.redirect('/student/daily-planner');
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Failed to update task status.' };
    res.redirect('/student/daily-planner');
  }
});

// -------------------- EDIT TASK --------------------
router.get('/edit-task/:task_id', async (req, res) => {
  if (!req.session.student) return res.redirect('/auth/login');

  try {
    const result = await pool.query('SELECT * FROM tasks WHERE task_id=$1', [req.params.task_id]);
    if (result.rows.length === 0) return res.send('Task not found!');
    res.render('edit-task', { student: req.session.student, task: result.rows[0], message: showMessage(req) });
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Error loading task.' };
    res.redirect('/student/daily-planner');
  }
});

router.post('/edit-task/:task_id', async (req, res) => {
  const { title, description, subject, start_time, end_time, priority } = req.body;
  try {
    await pool.query(`
      UPDATE tasks
      SET title=$1, description=$2, subject=$3, start_time=$4, end_time=$5, priority=$6
      WHERE task_id=$7
    `, [title, description, subject, start_time, end_time, priority, req.params.task_id]);

    req.session.message = { type: 'success', text: 'Task updated successfully!' };
    res.redirect('/student/daily-planner');
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Error updating task.' };
    res.redirect('/student/daily-planner');
  }
});

// -------------------- DELETE TASK --------------------
router.post('/delete-task/:task_id', async (req, res) => {
  try {
    await pool.query('DELETE FROM tasks WHERE task_id=$1', [req.params.task_id]);
    req.session.message = { type: 'success', text: 'Task deleted successfully!' };
    res.redirect('/student/daily-planner');
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Error deleting task.' };
    res.redirect('/student/daily-planner');
  }
});

// -------------------- STUDY TRACKER --------------------
router.get('/study-tracker', async (req, res) => {
  if (!req.session.student) return res.redirect('/auth/login');
  try {
    const result = await pool.query('SELECT * FROM study_sessions WHERE student_id=$1 ORDER BY start_time DESC, date_created DESC', [req.session.student.student_id]);
    res.render('study-tracker', { student: req.session.student, sessions: result.rows, message: showMessage(req) });
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Error loading study sessions.' };
    res.redirect('/student/dashboard');
  }
});

router.get('/log-session', (req, res) => {
  if (!req.session.student) return res.redirect('/auth/login');
  res.render('log-session', { student: req.session.student, message: showMessage(req) });
});

router.post('/log-session', async (req, res) => {
  const { subject, description, start_time, duration_minutes } = req.body;
  try {
    await pool.query(`
      INSERT INTO study_sessions (student_id, subject, description, start_time, duration_minutes)
      VALUES ($1,$2,$3,$4,$5)
    `, [req.session.student.student_id, subject, description, start_time || null, duration_minutes || 0]);

    req.session.message = { type: 'success', text: 'Study session logged successfully!' };
    res.redirect('/student/study-tracker');
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Error logging study session.' };
    res.redirect('/student/study-tracker');
  }
});

router.post('/delete-session/:study_id', async (req, res) => {
  try {
    await pool.query('DELETE FROM study_sessions WHERE study_id=$1', [req.params.study_id]);
    req.session.message = { type: 'success', text: 'Study session deleted successfully!' };
    res.redirect('/student/study-tracker');
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Error deleting study session.' };
    res.redirect('/student/study-tracker');
  }
});

// -------------------- PROFILE --------------------
router.get('/profile', async (req, res) => {
  if (!req.session.student) return res.redirect('/auth/login');
  try {
    const result = await pool.query('SELECT name, email, course, year_level FROM students WHERE student_id=$1', [req.session.student.student_id]);
    if (result.rows.length === 0) {
      req.session.message = { type: 'danger', text: 'Profile not found.' };
      return res.redirect('/student/dashboard');
    }
    res.render('profile', { user: result.rows[0], student: req.session.student, message: showMessage(req) });
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'danger', text: 'Error loading profile.' };
    res.redirect('/student/dashboard');
  }
});

router.post('/update-profile', async (req, res) => {
  const { name, course, year_level } = req.body;
  try {
    await pool.query('UPDATE students SET name=$1, course=$2, year_level=$3 WHERE student_id=$4', [name, course, year_level, req.session.student.student_id]);

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
