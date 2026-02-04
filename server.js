const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("./db");

const Question = require("./models/Question");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Quiz API is running 🚀");
});

app.get("/questions", async (req, res) => {
  const questions = await Question.find();
  res.json(questions);
});

app.post("/questions", async (req, res) => {
  const question = new Question(req.body);
  await question.save();
  res.json({ message: "Question added" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
