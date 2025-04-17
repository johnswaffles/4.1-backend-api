// server.js (Only showing the /chat route part - keep the rest of your file the same)

app.post("/chat", async (req, res) => {
  console.log("--- REQUEST START ---"); // Marker
  console.log("Received request body:", req.body);

  // --- MODIFIED: Expect 'history' array ---
  const { history } = req.body;
  console.log("Checkpoint 1: Extracted history variable.");

  // --- MODIFIED: Validate 'history' ---
  if (!history || !Array.isArray(history) || history.length === 0) {
     console.error("❌ Validation Error: 'history' array is missing, not an array, or empty.", history);
     console.log("Checkpoint 2a: History validation FAILED (is missing/empty)."); // Checkpoint
    return res.status(400).json({ error: "Invalid request: 'history' array is required." });
  }
  console.log("Checkpoint 2b: History validation PASSED (is present and array)."); // Checkpoint

  // Validate roles and content within the history array
  for (const [index, msg] of history.entries()) { // Add index for logging
     console.log(`Checkpoint 3a: Validating message index ${index}`); // Checkpoint
    if (!msg.role || !['user', 'assistant', 'system'].includes(msg.role) || typeof msg.content !== 'string') {
       console.error(`❌ Validation Error: Invalid message object in history at index ${index}:`, msg);
       console.log(`Checkpoint 3b: Message validation FAILED at index ${index}.`); // Checkpoint
       return res.status(400).json({ error: `Invalid message structure within the 'history' array at index ${index}.` }); // More specific error
    }
  }
  console.log("Checkpoint 3c: All messages in history PASSED validation."); // Checkpoint

  // If the code reaches here, validation passed. Now try the API call.
  try {
    console.log(`Checkpoint 4: Entering TRY block. Sending ${history.length} messages to OpenAI...`); // Checkpoint

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini-2025-04-14", // Ensure model is correct
      messages: history,
    });
    console.log("Checkpoint 5: OpenAI API call successful."); // Checkpoint

    if (!completion.choices || completion.choices.length === 0 || !completion.choices[0].message || !completion.choices[0].message.content) {
        console.error("❌ Invalid response structure from OpenAI:", completion);
        console.log("Checkpoint 6a: OpenAI response structure validation FAILED."); // Checkpoint
        throw new Error("Unexpected response format from OpenAI API.");
    }
    console.log("Checkpoint 6b: OpenAI response structure validation PASSED."); // Checkpoint

    const reply = completion.choices[0].message.content.trim();
    console.log("Received reply from OpenAI:", reply);
    console.log("Checkpoint 7: Sending successful JSON response to client."); // Checkpoint
    res.json({ reply });

  } catch (error) {
     console.log("Checkpoint 8: Entering CATCH block due to error."); // Checkpoint
     // Log different types of errors
     if (error.response) { // OpenAI API Error
         console.error("❌ OpenAI API Error:", error.response.status, error.response.data);
         res.status(error.response.status || 500).json({ error: error.response.data?.error?.message || "OpenAI API request failed." });
     } else if (error.request) { // Network Error
         console.error("❌ Network Error connecting to OpenAI:", error.message);
         res.status(503).json({ error: "Could not connect to the AI service." });
     } else { // Other Internal Errors
         console.error("❌ Internal Server Error:", error.message, error.stack); // Add stack trace
         res.status(500).json({ error: error.message || "An internal server error occurred." });
     }
  }
  console.log("--- REQUEST END ---"); // Marker
});

// (Keep the rest of your server.js the same - imports, express setup, PORT, app.listen)
