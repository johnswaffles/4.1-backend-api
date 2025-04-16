// server.js

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/chat', async (req, res) => {
  console.log('Received request:', req.body); // Log incoming request

  const { message } = req.body;

  if (!message) {
    console.log('No message provided');
    return res.status(400).json({ error: 'No message provided' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini-2025-04-14",
      messages: [{ role: "user", content: message }],
    });

    const reply = completion.choices[0].message.content;
    console.log('Reply:', reply);
    res.json({ reply });

  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Error from OpenAI API' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});