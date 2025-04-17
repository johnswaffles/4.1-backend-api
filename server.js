// ───────────────────────── server.js ─────────────────────────
import express from "express";
import cors    from "cors";
import dotenv  from "dotenv";
import multer  from "multer";
import { OpenAI } from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ─── Multer: keep files on disk  (./uploads) ─────────────────
const upload = multer({ dest: "uploads/" });

// ─── OpenAI client ───────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL  = process.env.OPENAI_MODEL || "gpt-4o-mini-2025-04-16";

// ─── Image Upload Route ──────────────────────────────────────
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const fileResp = await openai.files.create({
      file:  req.file.path,              // disk path
      purpose: "vision"
    });
    res.json({ file_id: fileResp.id });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Chat Route ──────────────────────────────────────────────
app.post("/chat", async (req, res) => {
  const { history } = req.body;
  if (!Array.isArray(history) || history.length === 0) {
    return res.status(400).json({ error: "Missing history array" });
  }

  // basic validation (unchanged) -----------------------------
  for (const [i, msg] of history.entries()) {
    const { role, content } = msg;
    const goodRole = ["system", "user", "assistant"].includes(role);
    const isText   = typeof content === "string";
    const isImage  =
      content && typeof content === "object" &&
      content.type === "image_file" &&
      typeof content.file_id === "string";

    if (!goodRole || !(isText || isImage)) {
      return res.status(400).json({ error: `Invalid message at index ${i}` });
    }
  }

  // NEW: normalise single‑object image messages --------------
  const messages = history.map(m => {
    if (
      typeof m.content === "object" &&
      m.content.type === "image_file"
    ) {
      return { ...m, content: [m.content] };   // wrap in array
    }
    return m;                                   // leave text untouched
  });

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages
    });
    res.json({ reply: completion.choices[0].message.content.trim() });
  } catch (err) {
    console.error("❌ OpenAI error:", err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// ─── Start server ────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Server listening on http://localhost:${PORT}`)
);
// ─────────────────────────────────────────────────────────────