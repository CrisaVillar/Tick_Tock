
const express = require('express');
const session = require('express-session');
const path = require('path');
const client = require('./conn');
const app = express();
const port = process.env.PORT || 2000;


app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');


app.use(session({
  secret: process.env.SESSION_SECRET || 'ticktock-secret',
  resave: false,
  saveUninitialized: false,
}));

app.use((req, res, next) => {
  res.locals.message = req.session.message;
  delete req.session.message;
  next();
});


app.get('/', (req, res) => res.render('index'));
app.use('/auth', require('./routes/auth'));
app.use('/student', require('./routes/student'));


app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
