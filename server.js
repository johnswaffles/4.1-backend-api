// server.js (CommonJS)

const express = require("express");
const cors    = require("cors");
require("dotenv").config();
const { OpenAI } = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app    = express();

app.use(cors());
app.use(express.json({ limit: "4mb" }));

// — Chat endpoint —
app.post("/chat", async (req, res) => {
  try {
    const { history } = req.body;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: history,
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// — Text‑to‑Speech endpoint —
app.get("/speech", async (req, res) => {
  try {
    const q = req.query.q?.toString() || "";
    const mp3 = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "coral",
      input: q.slice(0, 4000),
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.set({ "Content-Type": "audio/mpeg" }).send(buffer);
  } catch (e) {
    res.status(500).send("TTS error: " + e.message);
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`API listening on ${PORT}`));
