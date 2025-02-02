require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

// CORS configuration
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://fintracker-frontend.vercel.app",
    ],
    credentials: true,
  })
);

// Force HTTPS (only in production)
app.use((req, res, next) => {
  if (
    req.headers["x-forwarded-proto"] !== "https" &&
    process.env.NODE_ENV === "production"
  ) {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

// Create poolConfig and conditionally enable SSL
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
};

if (process.env.NODE_ENV === "production") {
  // For Render/Postgres, you typically need SSL with rejectUnauthorized: false
  poolConfig.ssl = { rejectUnauthorized: false };
  console.log("[DB] Production mode detected, enabling SSL...");
} else {
  console.log("[DB] Not in production mode, SSL not enabled.");
}

// PostgreSQL Connection using poolConfig
const pool = new Pool(poolConfig);

// User Registration
app.post("/register", async (req, res) => {
  console.log("[REGISTER] Request body:", req.body);
  const { username, password, email } = req.body;

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("[REGISTER] Password hashed successfully.");

    // Insert user into the database
    const newUserQuery = await pool.query(
      `INSERT INTO users (username, password, email)
       VALUES ($1, $2, $3)
       RETURNING id, username, email`,
      [username, hashedPassword, email]
    );
    const user = newUserQuery.rows[0];
    console.log("[REGISTER] Inserted user:", user);

    // Generate a JWT token for the new user
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    console.log("[REGISTER] JWT token generated.");

    // Return token and user object
    console.log("[REGISTER] Sending response with { token, user }.");
    res.json({ token, user });
  } catch (err) {
    console.error("[REGISTER] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// User Login
app.post("/login", async (req, res) => {
  console.log("[LOGIN] Request body:", req.body);
  const { username, password } = req.body;

  try {
    const userQuery = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );
    console.log("[LOGIN] DB query result:", userQuery.rows);

    if (!userQuery.rows.length) {
      console.log("[LOGIN] User not found:", username);
      return res.status(400).json({ error: "User not found" });
    }

    const user = userQuery.rows[0];

    // Compare password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.log("[LOGIN] Incorrect password for user:", username);
      return res.status(400).json({ error: "Incorrect password" });
    }

    // Generate a JWT token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    console.log("[LOGIN] JWT token generated for user ID:", user.id);

    // Return token and user
    console.log("[LOGIN] Sending response with { token, user }");
    res.json({ token, user });
  } catch (err) {
    console.error("[LOGIN] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Add Income
app.post("/income", async (req, res) => {
  console.log("[INCOME:POST] Request body:", req.body);
  const { userId, amount, source, date, transactionType } = req.body;
  try {
    const newIncome = await pool.query(
      "INSERT INTO income (user_id, amount, source, date, transaction_type) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [userId, amount, source, date, transactionType]
    );
    console.log("[INCOME:POST] Inserted income:", newIncome.rows[0]);
    res.json(newIncome.rows[0]);
  } catch (err) {
    console.error("[INCOME:POST] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Fetch expenses for a user
app.get("/expenses", async (req, res) => {
  console.log("[EXPENSES:GET] Query params:", req.query);
  const { userId } = req.query;
  try {
    const expenses = await pool.query(
      "SELECT * FROM expenses WHERE user_id = $1",
      [userId]
    );
    console.log("[EXPENSES:GET] Expenses found:", expenses.rows);
    res.json(expenses.rows);
  } catch (err) {
    console.error("[EXPENSES:GET] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Add an expense
app.post("/expenses", async (req, res) => {
  console.log("[EXPENSES:POST] Request body:", req.body);
  const { userId, amount, category, date, transactionType } = req.body;
  try {
    const newExpense = await pool.query(
      "INSERT INTO expenses (user_id, amount, category, date, transaction_type) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [userId, amount, category, date, transactionType]
    );
    console.log("[EXPENSES:POST] Inserted expense:", newExpense.rows[0]);
    res.json(newExpense.rows[0]);
  } catch (err) {
    console.error("[EXPENSES:POST] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Fetch user income
app.get("/income", async (req, res) => {
  console.log("[INCOME:GET] Query params:", req.query);
  const { userId } = req.query;
  try {
    const income = await pool.query(
      "SELECT * FROM income WHERE user_id = $1",
      [userId]
    );
    console.log("[INCOME:GET] Income found:", income.rows);
    res.json(income.rows);
  } catch (err) {
    console.error("[INCOME:GET] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
