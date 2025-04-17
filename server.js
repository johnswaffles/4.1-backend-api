// server.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { OpenAI } = require("openai");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/chat", async (req, res) => {
  console.log("--- REQUEST START ---");
  console.log("Received request body:", req.body);

  const { history } = req.body;
  console.log("Checkpoint 1: Extracted history variable.");

  if (!Array.isArray(history) || history.length === 0) {
    console.error("❌ Validation Error: 'history' array missing or empty.", history);
    return res.status(400).json({ error: "Invalid request: 'history' array is required." });
  }
  console.log("Checkpoint 2: History validation PASSED.");

  for (const [i, msg] of history.entries()) {
    if (!msg.role || !["system","user","assistant"].includes(msg.role) || typeof msg.content !== "string") {
      console.error(`❌ Invalid message at index ${i}:`, msg);
      return res.status(400).json({ error: `Bad message structure at index ${i}.` });
    }
  }
  console.log("Checkpoint 3: All messages in history valid.");

  try {
    console.log(`Checkpoint 4: Sending ${history.length} messages to OpenAI...`);
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini-2025-04-14",
      messages: history,
    });
    console.log("Checkpoint 5: OpenAI API call successful.");

    const reply = completion.choices[0].message.content.trim();
    console.log("Checkpoint 6: Reply received:", reply);
    console.log("--- REQUEST END ---");
    return res.json({ reply });
  } catch (error) {
    console.log("Checkpoint 7: Entering CATCH block.");
    if (error.response) {
      console.error("❌ OpenAI API Error:", error.response.status, error.response.data);
      return res.status(error.response.status || 500).json({ error: error.response.data?.error?.message || "OpenAI API failed." });
    } else if (error.request) {
      console.error("❌ Network Error:", error.message);
      return res.status(503).json({ error: "Could not reach AI service." });
    } else {
      console.error("❌ Server Error:", error);
      return res.status(500).json({ error: "Internal server error." });
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});