// server.js
const express = require("express");
const cors    = require("cors");
const dotenv  = require("dotenv");
const { OpenAI } = require("openai");

// Load .env into process.env
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Fallback if env var is missing
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini-2025-04-14";

app.post("/chat", async (req, res) => {
  console.log("--- REQUEST START ---");
  console.log("Incoming body:", req.body);

  const { history } = req.body;
  if (!Array.isArray(history) || history.length === 0) {
    console.error("❌ No history array provided");
    return res.status(400).json({ error: "Missing history array" });
  }

  // Validate each message
  for (const [i, msg] of history.entries()) {
    if (
      !msg.role ||
      !["system","user","assistant"].includes(msg.role) ||
      typeof msg.content !== "string"
    ) {
      console.error(`❌ Bad message at index ${i}:`, msg);
      return res.status(400).json({ error: `Invalid message at index ${i}` });
    }
  }

  try {
    console.log(`Using model: ${MODEL}`);
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: history,
    });
    console.log("Received reply from model:", completion.model);

    const reply = completion.choices[0].message.content.trim();
    console.log("Reply:", reply);
    console.log("--- REQUEST END ---");
    return res.json({ reply });

  } catch (err) {
    console.error("❌ OpenAI error:", err);
    const status = err.response?.status || 500;
    const errorMsg = err.response?.data?.error?.message || err.message;
    return res.status(status).json({ error: errorMsg });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});