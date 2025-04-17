// server.js
const express = require("express");
const cors    = require("cors");
const dotenv  = require("dotenv");
const multer  = require("multer");
const { OpenAI } = require("openai");

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Multer setup for in‑memory file uploads
const upload = multer();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Model from env (fallback if missing)
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini-2025-04-14";

// ─── Image Upload Route ────────────────────────────────────────────────────────
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    // Send the file buffer to OpenAI and get back an ID
    const fileResp = await openai.files.create({
      file: {
        buffer: req.file.buffer,
        filename: req.file.originalname
      },
      purpose: "vision"
    });

    return res.json({ file_id: fileResp.id });
  } catch (err) {
    console.error("❌ Upload error:", err);
    return res.status(500).json({ error: "Upload failed" });
  }
});
// ────────────────────────────────────────────────────────────────────────────────

// ─── Chat Route ─────────────────────────────────────────────────────────────────
app.post("/chat", async (req, res) => {
  console.log("--- REQUEST START ---");
  console.log("Incoming body:", req.body);

  const { history } = req.body;
  if (!Array.isArray(history) || history.length === 0) {
    return res.status(400).json({ error: "Missing history array" });
  }

  // Validate each message (text or image_file)
  for (const [i, msg] of history.entries()) {
    const { role, content } = msg;
    const validRole = ["system","user","assistant"].includes(role);
    const isText = typeof content === "string";
    const isImage =
      content &&
      typeof content === "object" &&
      content.type === "image_file" &&
      typeof content.file_id === "string";

    if (!validRole || !(isText || isImage)) {
      console.error(`❌ Bad message at index ${i}:`, msg);
      return res.status(400).json({ error: `Invalid message at index ${i}` });
    }
  }

  try {
    console.log(`Using model: ${MODEL}`);
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: history
    });

    const reply = completion.choices[0].message.content.trim();
    console.log("Reply:", reply);
    console.log("--- REQUEST END ---");

    return res.json({ reply });
  } catch (err) {
    console.error("❌ OpenAI error:", err);
    const status   = err.response?.status || 500;
    const errorMsg = err.response?.data?.error?.message || err.message;
    return res.status(status).json({ error: errorMsg });
  }
});
// ────────────────────────────────────────────────────────────────────────────────

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});