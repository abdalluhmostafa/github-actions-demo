const express = require("express");
const bodyParser = require("body-parser");
const session = require('express-session');
const bcrypt = require('bcrypt');
const pool = require('./db');
const morgan = require('morgan');

const app = express();
const port = process.env.PORT || 3000;

// Function to initialize the database
async function initializeDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL PRIMARY KEY,
            user_id INT REFERENCES users(id) ON DELETE CASCADE,
            task TEXT NOT NULL
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS completed_tasks (
            id SERIAL PRIMARY KEY,
            user_id INT REFERENCES users(id) ON DELETE CASCADE,
            task TEXT NOT NULL
        );
    `);
}

// Call the function to initialize the database
initializeDatabase().catch(err => console.error('Error initializing database:', err));

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true
}));
app.use(morgan('combined'));

// Middleware to check if the user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/login');
}

// Redirect root to /home
app.get('/', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/home');
    }
    res.redirect('/login');
});

// Home route
app.get('/home', isAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const tasks = await pool.query('SELECT * FROM tasks WHERE user_id = $1', [userId]);
    const completedTasks = await pool.query('SELECT * FROM completed_tasks WHERE user_id = $1', [userId]);
    res.render("index", { task: tasks.rows, complete: completedTasks.rows });
});

// Login route
app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (result.rows.length > 0) {
        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);

        if (match) {
            req.session.userId = user.id;
            return res.redirect('/home');
        }
    }
    res.redirect('/login');
});

// Signup route
app.get('/signup', (req, res) => {
    res.render('signup');
});

app.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hashedPassword]);
    res.redirect('/login');
});

// Middleware to ensure only logged-in users can access the todo list
app.post("/addtask", isAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const newTask = req.body.newtask;
    await pool.query('INSERT INTO tasks (user_id, task) VALUES ($1, $2)', [userId, newTask]);
    res.redirect("/home");
});

app.post("/removetask", isAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const completeTask = req.body.check;

    if (typeof completeTask === "string") {
        await pool.query('DELETE FROM tasks WHERE user_id = $1 AND task = $2', [userId, completeTask]);
        await pool.query('INSERT INTO completed_tasks (user_id, task) VALUES ($1, $2)', [userId, completeTask]);
    } else if (typeof completeTask === "object") {
        for (var i = 0; i < completeTask.length; i++) {
            await pool.query('DELETE FROM tasks WHERE user_id = $1 AND task = $2', [userId, completeTask[i]]);
            await pool.query('INSERT INTO completed_tasks (user_id, task) VALUES ($1, $2)', [userId, completeTask[i]]);
        }
    }
    res.redirect("/home");
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error logging out', err);
        }
        res.redirect('/login');
    });
});

app.listen(port, () => {
    console.log("Server is running on port http://localhost:" + port);
});
