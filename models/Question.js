const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema({
  text: String,
  score: Number,
});

const questionSchema = new mongoose.Schema({
  questionText: String,
  answers: [answerSchema],
});

module.exports = mongoose.model("Question", questionSchema);

