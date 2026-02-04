const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// 🔗 MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// 🧠 Question schema
const questionSchema = new mongoose.Schema({
  questionText: String,
  answers: [
    {
      text: String,
      score: Number,
    },
  ],
});

const Question = mongoose.model("Question", questionSchema);

// ✅ ROOT ROUTE (optional, but good)
app.get("/", (req, res) => {
  res.send("Quiz Backend is running 🚀");
});

// ✅ THIS IS THE MISSING PART 👇👇👇
app.get("/questions", async (req, res) => {
  try {
    const questions = await Question.find();
    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// 🔊 PORT (Render requires this)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
