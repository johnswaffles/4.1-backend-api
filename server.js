import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import { OpenAI } from "openai";

// ─── Config ───────────────────────────────────────────────────────────────────
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini-2025-04-14";

// ─── Multer: DISK storage (tmp dir) instead of memory ─────────────────────────
const uploadDir = "/tmp/uploads";               // Render’s /tmp is fast & empty
await fs.mkdir(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 15 * 1024 * 1024 }        // 15 MB max
});

// ─── Image Upload Route ───────────────────────────────────────────────────────
app.post("/upload", upload.single("file"), async (req, res) => {
  const tmpPath = req.file.path;                // where Multer stored it
  try {
    const fileResp = await openai.files.create({
      file: {
        // create a readable stream instead of loading into memory
        stream: await fs.open(tmpPath, "r").then(fh => fh.createReadStream()),
        filename: req.file.originalname
      },
      purpose: "vision"
    });

    res.json({ file_id: fileResp.id });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  } finally {
    // Clean up no‑matter‑what
    fs.unlink(tmpPath).catch(() => {});
  }
});
// ──────────────────────────────────────────────────────────────────────────────

// ─── Chat Route ───────────────────────────────────────────────────────────────
app.post("/chat", async (req, res) => {
  console.log("--- REQUEST START ---");
  console.log("Incoming body:", req.body);

  const { history } = req.body;
  if (!Array.isArray(history) || history.length === 0) {
    return res.status(400).json({ error: "Missing history array" });
  }

  // validate messages
  for (const [i, msg] of history.entries()) {
    const { role, content } = msg;
    const validRole = ["system", "user", "assistant"].includes(role);
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

    res.json({ reply });
  } catch (err) {
    console.error("❌ OpenAI error:", err);
    const status   = err.response?.status || 500;
    const errorMsg = err.response?.data?.error?.message || err.message;
    res.status(status).json({ error: errorMsg });
  }
});
// ──────────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});