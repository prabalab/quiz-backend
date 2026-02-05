const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./models/User");

// 🔗 MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// 🧠 Question schema
const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: true,
  },
  answers: [
    {
      text: { type: String, required: true },
      score: { type: Number, required: true },
    },
  ],
});

const Question = mongoose.model("Question", questionSchema);

// ✅ ROOT ROUTE
app.get("/", (req, res) => {
  res.send("Quiz Backend is running 🚀");
});

// ✅ GET all questions
app.get("/questions", async (req, res) => {
  try {
    const questions = await Question.find();
    res.status(200).json(questions);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch questions" });
  }
});

// ✅ ADD question (THIS WAS MISSING)
app.post("/questions", authMiddleware, async (req, res) => {
  try {
    const { questionText, answers } = req.body;

    if (!questionText || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        message: "Question and answers are required",
      });
    }

    // 🔍 Validate each answer
    for (const ans of answers) {
      if (
        typeof ans.text !== "string" ||
        typeof ans.score !== "number"
      ) {
        return res.status(400).json({
          message: "Each answer must have text (string) and score (number)",
        });
      }
    }

    const question = new Question({
      questionText,
      answers,
    });

    await question.save();

    res.status(201).json({
      message: "Question added successfully ✅",
    });
  } catch (error) {
    console.error("Save error:", error);
    res.status(500).json({
      message: "Failed to add question",
    });
  }
});

app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      email,
      password: hashedPassword,
    });

    await user.save();

    res.status(201).json({ message: "User registered successfully ✅" });
  } catch (error) {
    res.status(500).json({ message: "Registration failed" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful ✅",
      token: token,
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed" });
  }
});

const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};


// 🔊 PORT (Render requires this)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
