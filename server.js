// server.js (CommonJS or .cjs file)
import express from 'express';
import OpenAI from 'openai';

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post('/chat', async (req, res) => {
  try {
    const { history } = req.body;
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',    // or whichever vision‐capable model
      messages: history.map(m => ({
        role: m.role,
        content: m.content     // <-- allow string OR array here
      }))
    });
    res.json({ reply: response.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT||3000, () => console.log('Listening'));