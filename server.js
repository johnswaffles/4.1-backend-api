// server.js  (ESM – package.json already has "type":"module")
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { OpenAI } from "openai";

// ─── env & init ───────────────────────────────────────────────────────────────
dotenv.config();
const app     = express();
const upload  = multer();                      // ─ in‑memory
app.use(cors());
app.use(express.json());

const openai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL   = process.env.OPENAI_MODEL || "gpt-4o-mini";
// ──────────────────────────────────────────────────────────────────────────────


// ─── Helpers ──────────────────────────────────────────────────────────────────
function bad(res, msg) {
  return res.status(400).json({ error: msg });
}
function log(...args) { console.log("[api]", ...args); }
// ──────────────────────────────────────────────────────────────────────────────


// ─── Upload Route ────────────────────────────────────────────────────────────
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return bad(res, "No file uploaded");

  try {
    const file = {
      data: req.file.buffer,          // <- SDK v4 format
      name: req.file.originalname
    };

    const { id } = await openai.files.create({
      file,
      purpose: "vision"
    });

    return res.json({ file_id: id });
  } catch (err) {
    console.error("upload error:", err);
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});
// ──────────────────────────────────────────────────────────────────────────────


// ─── Chat Route ───────────────────────────────────────────────────────────────
app.post("/chat", async (req, res) => {
  const { history } = req.body;
  if (!Array.isArray(history) || !history.length)
    return bad(res, "`history` must be a non‑empty array");

  // validate messages
  for (const [i, m] of history.entries()) {
    if (!["user", "assistant", "system"].includes(m.role))
      return bad(res, `msg ${i}: invalid role`);

    const isText  = typeof m.content === "string";
    const isImage =
      m.content &&
      typeof m.content === "object" &&
      m.content.type === "image_file" &&
      typeof m.content.file_id === "string";

    if (!isText && !isImage)
      return bad(res, `msg ${i}: invalid content format`);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: history
    });
    return res.json({ reply: completion.choices[0].message.content.trim() });
  } catch (err) {
    console.error("openai error:", err);
    return res.status(err.status ?? 502).json({ error: err.message });
  }
});
// ──────────────────────────────────────────────────────────────────────────────


// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => log(`Listening on http://localhost:${PORT}`));