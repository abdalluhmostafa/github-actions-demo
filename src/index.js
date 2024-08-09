const express = require("express");
const bodyParser = require("body-parser");
const session = require('express-session');
const bcrypt = require('bcrypt');
const { Pool } = require("pg");
const morgan = require('morgan');

const app = express();
const port = process.env.PORT || 3000;

// Environment variables for DB connection
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'todoapp',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
};

// Database connection setup
const pool = new Pool(dbConfig);

pool.connect(async (err, client, release) => {
    if (err) {
        console.error('Error acquiring client', err.stack);
        app.get("/", (req, res) => {
            res.send("Database connection failed");
        });
    } else {
        console.log('Connected to the database');
        app.get("/", (req, res) => {
            res.send("Connected to the database");
        });

        // Automatically create schema if it doesn't exist
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                task TEXT NOT NULL,
                completed BOOLEAN DEFAULT false
            );
            CREATE TABLE IF NOT EXISTS completed_tasks (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                task TEXT NOT NULL
            );
        `;

        try {
            await client.query(createTableQuery);
            console.log('Schema setup complete');
        } catch (err) {
            console.error('Error creating schema', err.stack);
        } finally {
            release();
        }
    }
});

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
            return res.redirect('/');
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
app.get("/", isAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const tasks = await pool.query('SELECT * FROM tasks WHERE user_id = $1', [userId]);
    const completedTasks = await pool.query('SELECT * FROM completed_tasks WHERE user_id = $1', [userId]);
    res.render("index", { task: tasks.rows, complete: completedTasks.rows });
});

app.post("/addtask", isAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const newTask = req.body.newtask;
    await pool.query('INSERT INTO tasks (user_id, task) VALUES ($1, $2)', [userId, newTask]);
    res.redirect("/");
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
    res.redirect("/");
});

app.listen(port, () => {
    console.log("Server is running on port http://localhost:" + port);
});
