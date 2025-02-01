require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

// CORS configuration
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'https://fintracker.vercel.app'],
    credentials: true
}));

  
// Force HTTPS
app.use((req, res, next) => {
if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
}
next();
});

// PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// User Registration
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const newUser = await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username",
      [username, hashedPassword]
    );
    res.json(newUser.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (!user.rows.length) return res.status(400).json({ error: "User not found" });

    const validPassword = await bcrypt.compare(password, user.rows[0].password);
    if (!validPassword) return res.status(400).json({ error: "Incorrect password" });

    const token = jwt.sign({ userId: user.rows[0].id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.json({ token, user: user.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Income
app.post("/income", async (req, res) => {
  const { userId, amount, source } = req.body;
  try {
    const newIncome = await pool.query(
      "INSERT INTO income (user_id, amount, source) VALUES ($1, $2, $3) RETURNING *",
      [userId, amount, source]
    );
    res.json(newIncome.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch expenses for a user
app.get("/expenses", async (req, res) => {
    const { userId } = req.query;
    try {
      const expenses = await pool.query("SELECT * FROM expenses WHERE user_id = $1", [userId]);
      res.json(expenses.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Add an expense
  app.post("/expenses", async (req, res) => {
    const { userId, amount, category } = req.body;
    try {
      const newExpense = await pool.query(
        "INSERT INTO expenses (user_id, amount, category) VALUES ($1, $2, $3) RETURNING *",
        [userId, amount, category]
      );
      res.json(newExpense.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Fetch user income
  app.get("/income", async (req, res) => {
    const { userId } = req.query;
    try {
      const income = await pool.query("SELECT * FROM income WHERE user_id = $1", [userId]);
      res.json(income.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
