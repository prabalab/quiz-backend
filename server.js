const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("./models/User");

const app = express();
app.use(cors());
app.use(express.json());

// 🔗 MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

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

const sendOTP = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: email,
    subject: "Your Quiz App OTP Verification",
    text: `Your OTP is: ${otp}. It will expire in 5 minutes.`,
  });
};


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

// ===================== AUTH =====================

// ✅ Register
app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email & password required" });

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      email,
      password: hashedPassword,
      otp,
      otpExpires: new Date(Date.now() + 5 * 60 * 1000), // 5 min
      isVerified: false,
    });

    await user.save();

    await sendOTP(email, otp);

    res.status(201).json({
      message: "OTP sent to email ✅",
    });
  } catch (error) {
    console.log("REGISTER ERROR:", error);
    res.status(500).json({ message: "Registration failed" });
  }
});
//otp verification 
app.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: "User not found" });

    if (user.isVerified)
      return res.status(400).json({ message: "Already verified" });

    if (user.otp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    if (user.otpExpires < new Date())
      return res.status(400).json({ message: "OTP expired" });

    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;

    await user.save();

    res.status(200).json({ message: "Email verified successfully ✅" });
  } catch (error) {
    res.status(500).json({ message: "OTP verification failed" });
  }
});


// ✅ Login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
  if (!user.isVerified) {
  return res.status(400).json({ message: "Email not verified ❌" });
}
    res.status(200).json({
      message: "Login successful ✅",
      token,
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ message: "Login failed" });
  }

});

// ===================== AUTH MIDDLEWARE =====================

const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// ===================== PROTECTED ROUTE =====================

// ✅ ADD question (Protected)
app.post("/questions", authMiddleware, async (req, res) => {
  try {
    const { questionText, answers } = req.body;

    if (!questionText || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        message: "Question and answers are required",
      });
    }

    for (const ans of answers) {
      if (typeof ans.text !== "string" || typeof ans.score !== "number") {
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
    console.error("SAVE QUESTION ERROR:", error);
    res.status(500).json({
      message: "Failed to add question",
    });
  }
});

// 🔊 PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
