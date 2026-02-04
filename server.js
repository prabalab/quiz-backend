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
app.post("/questions", async (req, res) => {
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


// 🔊 PORT (Render requires this)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
