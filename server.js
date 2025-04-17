// ── server.js ────────────────────────────────────────────────────────────────
import express from "express";
import cors    from "cors";
import dotenv  from "dotenv";
import multer  from "multer";
import fs      from "node:fs";
import { OpenAI } from "openai";

// Load .env
dotenv.config();

// ── App & middleware ─────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// ── Multer: save files to disk (./uploads/…) ────────────────────────────────
const upload = multer({ dest: "uploads/" });

// ── OpenAI client ────────────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL  = process.env.OPENAI_MODEL || "gpt-4o-mini-2025-04-16";

// ── /upload  →  returns { file_id } ──────────────────────────────────────────
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    // Multer wrote the file to disk → stream it to OpenAI
    const fileResp = await openai.files.create({
      file: fs.createReadStream(req.file.path),
      purpose: "vision"
    });

    // Optional: delete local file now that it’s stored on OpenAI
    fs.unlink(req.file.path, () => {});

    return res.json({ file_id: fileResp.id });
  } catch (err) {
    console.error("❌ Upload error:", err);
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ── /chat  →  returns { reply } ──────────────────────────────────────────────
app.post("/chat", async (req, res) => {
  const { history } = req.body;
  if (!Array.isArray(history) || history.length === 0) {
    return res.status(400).json({ error: "Missing history array" });
  }

  // Basic validation
  for (const [i, msg] of history.entries()) {
    const validRole = ["system", "user", "assistant"].includes(msg.role);
    const isText    = typeof msg.content === "string";

    const isImage   =
      typeof msg.content === "object" &&
      msg.content?.type === "image_file" &&
      typeof msg.content?.file_id === "string";

    if (!validRole || !(isText || isImage)) {
      return res
        .status(400)
        .json({ error: `Invalid message at index ${i}` });
    }
  }

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: history
    });

    const reply = completion.choices[0].message.content.trim();
    return res.json({ reply });
  } catch (err) {
    console.error("❌ OpenAI error:", err);
    return res
      .status(err.status ?? 500)
      .json({ error: err.error?.message ?? err.message });
  }
});

// ── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Server listening on http://localhost:${PORT}`)
);
// ─────────────────────────────────────────────────────────────────────────────