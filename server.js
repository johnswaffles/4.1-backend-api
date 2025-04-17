// server.js  ────────────────────────────────────────────────────────────
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { OpenAI } from "openai";

const openai = new OpenAI({
  // If you already set OPENAI_API_KEY in Render → Environment, you can omit this.
  apiKey: process.env.OPENAI_API_KEY,
});

const upload = multer({ dest: "uploads/" });       // disk storage

const app = express();
app.use(express.json());

// ── POST /chat  (multipart form:  prompt=<text>  image=<file>)
app.post("/chat", upload.single("image"), async (req, res) => {
  let visionFileId;

  try {
    // 1) upload the image to OpenAI’s files endpoint
    if (req.file) {
      const fileResp = await openai.files.create({
        file: fs.createReadStream(req.file.path),
        purpose: "vision",
      });
      visionFileId = fileResp.id;
    }

    // 2) build the user‑message content
    const userContent = [];
    if (visionFileId) {
      userContent.push({
        type: "image_url",
        image_url: { url: `attach://${visionFileId}` },
      });
    }
    if (req.body.prompt) {
      userContent.push({ type: "text", text: req.body.prompt });
    }

    // 3) call chat completions
    const chatResp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: userContent },
      ],
      attachments: visionFileId ? [{ id: visionFileId }] : undefined,
    });

    const answer = chatResp.choices[0].message.content;
    res.json({ answer });
  } catch (err) {
    console.error("❌ OpenAI error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    // always delete the temp file
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
  }
});

// ── listen ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`✅ Server listening on http://localhost:${PORT}`)
);