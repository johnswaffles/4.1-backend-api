// ────────────────────────────────────────────────────
// server.js  ―  disk‑based uploads + OpenAI v4 SDK
// ────────────────────────────────────────────────────
import express from "express";
import cors    from "cors";
import dotenv  from "dotenv";
import multer  from "multer";
import fs      from "node:fs/promises";
import path    from "node:path";
import { fileURLToPath } from "node:url";
import { OpenAI } from "openai";

// Load .env ──────────────────────────────────────────
dotenv.config();

// Express setup ──────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// Multer *disk* storage (files are placed in /tmp) ───
const upload = multer({
  dest: "/tmp",               // Render’s ephemeral disk
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max
});

// OpenAI client ──────────────────────────────────────
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Fallback model name if env var missing──────────────
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// ─── Image Upload Route ─────────────────────────────
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    // ➊ Create a readable stream from the temp file
    const fileStream = await fs.open(req.file.path, "r").then(f => f.createReadStream());

    // ➋ Send to OpenAI – v4 SDK expects *just* the stream
    const uploadResp = await openai.files.create({
      file: fileStream,                 // <‑‑ no nested object
      purpose: "vision"
    });

    // ➌ Clean up temp file
    await fs.unlink(req.file.path).catch(() => {});

    return res.json({ file_id: uploadResp.id });
  } catch (err) {
    console.error("❌ Upload error:", err);
    return res.status(500).json({ error: err.message });
  }
});
// ────────────────────────────────────────────────────

// ─── Chat Route (unchanged) ─────────────────────────
app.post("/chat", async (req, res) => {
  console.log("--- REQUEST START ---");
  console.log("Incoming body:", req.body);

  const { history } = req.body;
  if (!Array.isArray(history) || history.length === 0) {
    return res.status(400).json({ error: "Missing history array" });
  }

  // minimal validation (text | image_file) … unchanged
  for (const [i, msg] of history.entries()) {
    const { role, content } = msg;
    const roleOk = ["system", "user", "assistant"].includes(role);
    const isText = typeof content === "string";
    const isImage =
      content && typeof content === "object" &&
      content.type === "image_file" && typeof content.file_id === "string";

    if (!roleOk || !(isText || isImage)) {
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
    const message  = err.response?.data?.error?.message || err.message;
    return res.status(status).json({ error: message });
  }
});
// ────────────────────────────────────────────────────

// Start server ───────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});