// server.js
const express = require('express');
const cors    = require('cors');
const dotenv  = require('dotenv');
const { OpenAI } = require('openai');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post('/chat', async (req, res) => {
  try {
    const { history } = req.body;
    const chat = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: history.map(m => ({
        role: m.role,
        content: m.content
      }))
    });
    res.json({ reply: chat.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});