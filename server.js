const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const { Resend } = require("resend");

const app = express();
app.use(cors());
app.use(express.json());

// =======================
// ENV CHECK
// =======================
if (!process.env.MONGO_URI) console.log("❌ MONGO_URI missing");
if (!process.env.JWT_SECRET) console.log("❌ JWT_SECRET missing");
if (!process.env.RESEND_API_KEY) console.log("❌ RESEND_API_KEY missing");

// =======================
// MongoDB
// =======================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// =======================
// Models
// =======================
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    otp: { type: String },
    otpExpires: { type: Date },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

const questionSchema = new mongoose.Schema(
  {
    questionText: { type: String, required: true },
    answers: [
      {
        text: { type: String, required: true },
        score: { type: Number, required: true },
      },
    ],
  },
  { timestamps: true }
);

const Question = mongoose.model("Question", questionSchema);

// =======================
// Resend Setup
// =======================
const resend = new Resend(process.env.RESEND_API_KEY);

const sendOTPEmail = async (email, otp) => {
  await resend.emails.send({
    from: "Quiz App <onboarding@resend.dev>",
    to: email,
    subject: "Your Quiz App OTP Code",
    html: `
      <h2>Your OTP is: <b>${otp}</b></h2>
      <p>This OTP is valid for <b>10 minutes</b>.</p>
    `,
  });
};

// =======================
// Helpers
// =======================
const generateOTP = () => crypto.randomInt(100000, 999999).toString();

// =======================
// Middleware
// =======================
const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// =======================
// Routes
// =======================

// Root
app.get("/", (req, res) => {
  res.send("Quiz Backend with Resend OTP is running 🚀");
});

// -----------------------
// Register (Send OTP)
// -----------------------
app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const existingUser = await User.findOne({ email });

    // Already verified
    if (existingUser && existingUser.isVerified) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    const hashedPassword = await bcrypt.hash(password, 10);

    // Existing but not verified -> update OTP
    if (existingUser && !existingUser.isVerified) {
      existingUser.password = hashedPassword;
      existingUser.otp = otp;
      existingUser.otpExpires = otpExpires;
      await existingUser.save();
    } else {
      // New user
      const newUser = new User({
        email,
        password: hashedPassword,
        otp,
        otpExpires,
        isVerified: false,
      });
      await newUser.save();
    }

    // Send OTP using Resend
    await sendOTPEmail(email, otp);

    res.status(201).json({ message: "OTP sent to email ✅" });
  } catch (error) {
    console.log("REGISTER ERROR:", error);
    res.status(500).json({ message: "Registration failed", error });
  }
});

// -----------------------
// Verify OTP
// -----------------------
app.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp)
      return res.status(400).json({ message: "Email and OTP required" });

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
    console.log("VERIFY OTP ERROR:", error);
    res.status(500).json({ message: "OTP verification failed" });
  }
});

// -----------------------
// Resend OTP
// -----------------------
app.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: "Email required" });

    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: "User not found" });

    if (user.isVerified)
      return res.status(400).json({ message: "Already verified" });

    const otp = generateOTP();

    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOTPEmail(email, otp);

    res.status(200).json({ message: "New OTP sent ✅" });
  } catch (error) {
    console.log("RESEND OTP ERROR:", error);
    res.status(500).json({ message: "Resend OTP failed" });
  }
});

// -----------------------
// Login
// -----------------------
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: "User not found" });

    if (!user.isVerified) {
      return res.status(400).json({ message: "Email not verified ❌" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(200).json({
      message: "Login successful ✅",
      token,
    });
  } catch (error) {
    console.log("LOGIN ERROR:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

// -----------------------
// Questions
// -----------------------
app.get("/questions", async (req, res) => {
  try {
    const questions = await Question.find();
    res.status(200).json(questions);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch questions" });
  }
});

app.post("/questions", authMiddleware, async (req, res) => {
  try {
    const { questionText, answers } = req.body;

    if (!questionText || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ message: "Invalid question data" });
    }

    for (const ans of answers) {
      if (!ans.text || typeof ans.score !== "number") {
        return res.status(400).json({
          message: "Each answer must have text and score",
        });
      }
    }

    const question = new Question({ questionText, answers });
    await question.save();

    res.status(201).json({ message: "Question added successfully ✅" });
  } catch (error) {
    res.status(500).json({ message: "Failed to add question" });
  }
});

// =======================
// PORT
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
