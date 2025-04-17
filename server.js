// ────────────────────────── server.js ──────────────────────────
import express from "express";
import cors    from "cors";
import multer  from "multer";
import dotenv  from "dotenv";
import fs      from "node:fs/promises";
import path    from "node:path";
import { OpenAI } from "openai";

// ───── Env vars ────────────────────────────────────────────────
dotenv.config();

const PORT        = process.env.PORT         || 3000;
const MODEL       = process.env.OPENAI_MODEL || "gpt-4.1-mini-2025-04-14";
const UPLOAD_DIR  = process.env.UPLOAD_DIR   || path.join("/tmp", "uploads");

// Ensure the upload directory exists at boot
await fs.mkdir(UPLOAD_DIR, { recursive: true });

// ───── Express setup ───────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// ───── Multer (disk) setup ─────────────────────────────────────
// Each uploaded file is streamed to disk in UPLOAD_DIR.
// filename keeps the original name + a timestamp prefix to avoid collisions.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename   : (_req, file, cb)  =>
    cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// ───── OpenAI client ───────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ───── Routes ─────────────────────────────────────────────────

// 1.  POST /upload  → returns { file_id }
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    // Create a read‑stream *from disk* (not memory)
    const filePath = req.file.path;

    const fileResp = await openai.files.create({
      file: {
        buffer: await fs.readFile(filePath),
        filename: req.file.originalname
      },
      purpose: "vision"
    });

    // OPTIONAL: delete the local copy to save disk space
    await fs.unlink(filePath).catch(() => {});

    return res.json({ file_id: fileResp.id });
  } catch (err) {
    console.error("❌ Upload error:", err);
    return res.status(500).json({ error: "Upload failed" });
  }
});

// 2.  POST /chat  → { reply }
app.post("/chat", async (req, res) => {
  console.log("--- REQUEST START ---");
  console.log("Incoming body:", req.body);

  const { history } = req.body;
  if (!Array.isArray(history) || history.length === 0) {
    return res.status(400).json({ error: "Missing history array" });
  }

  // Basic validation (text or image_file)
  for (const [i, msg] of history.entries()) {
    const { role, content } = msg;
    const validRole = ["system", "user", "assistant"].includes(role);
    const isText    = typeof content === "string";
    const isImage   =
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

// ───── Boot ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});