const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// 1. Basic Middleware & Security Guardrails
app.use(cors());

// Strict JSON size limit to prevent memory/buffer overflow attacks
app.use(express.json({ limit: '2kb' })); 

// Rate limiting: max 30 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, 
  message: { error: 'Too many requests. Please focus on your tasks and try again shortly.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Serve Static Frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// 2. Simple Local Backup Parsers (Model Efficiency fallback)
function fallbackDecompose(title) {
  const t = title.toLowerCase();
  if (t.includes('code') || t.includes('dev') || t.includes('app') || t.includes('build') || t.includes('fix')) {
    return [
      { title: 'Define interface and data structures', duration: 10 },
      { title: 'Implement functional logic & core classes', duration: 20 },
      { title: 'Test boundaries and fix exceptions', duration: 10 },
      { title: 'Verify deployment environment', duration: 5 }
    ];
  } else if (t.includes('write') || t.includes('doc') || t.includes('essay') || t.includes('report') || t.includes('draft')) {
    return [
      { title: 'Review references & outline structure', duration: 10 },
      { title: 'Draft content sections and illustrations', duration: 25 },
      { title: 'Syntax editing and proofreading', duration: 10 }
    ];
  } else {
    return [
      { title: 'Analyze core criteria & requirements', duration: 5 },
      { title: 'Execute primary implementation task', duration: 20 },
      { title: 'Run final quality check', duration: 5 }
    ];
  }
}

// 3. Security Inspection: Check for Prompt Injection / Manipulation attempts
function detectPromptInjection(text) {
  const lower = text.toLowerCase();
  const injectionPatterns = [
    'ignore previous instructions',
    'system prompt',
    'you are now a',
    'bypass',
    'override',
    'do not follow',
    'forget everything'
  ];
  
  return injectionPatterns.some(pattern => lower.includes(pattern));
}

// 4. API Proxy Endpoint: Decompose Task
app.post('/api/decompose', async (req, res) => {
  const { title } = req.body;

  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'Invalid task title.' });
  }

  // Guardrail check
  if (detectPromptInjection(title)) {
    return res.status(400).json({ 
      error: 'Security Warning: Input blocked. Prompt manipulation or injection keywords detected.' 
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Return fallback sandbox data if no API Key is configured
    console.log("No GEMINI_API_KEY configured. Returning sandbox fallback response.");
    return res.json({ subtasks: fallbackDecompose(title), source: 'sandbox' });
  }

  const promptText = `Decompose the task: "${title}" into 3-5 specific, action-oriented step-by-step subtasks with individual durations in minutes. 
  You MUST return ONLY a raw JSON array matching this format (no markdown code fence blocks, no additional text, just the valid parsable JSON array):
  [
    {"title": "Subtask action description", "duration": 10},
    {"title": "Next action description", "duration": 15}
  ]
  Keep the total combined duration between 20 to 60 minutes. Provide actionable concrete steps.`;

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini response: ${response.status}`);
    }

    const data = await response.json();
    let text = data.candidates[0].content.parts[0].text.trim();
    
    // Clean up code fences
    if (text.startsWith('```json')) text = text.substring(7);
    if (text.endsWith('```')) text = text.substring(0, text.length - 3);
    text = text.trim();

    const subtasks = JSON.parse(text);
    return res.json({ subtasks, source: 'gemini' });
  } catch (error) {
    console.error("Gemini Proxy Error:", error);
    return res.json({ subtasks: fallbackDecompose(title), source: 'fallback_sandbox' });
  }
});

// 5. API Proxy Endpoint: Chat / Advice / Automatic Task Classification
app.post('/api/chat', async (req, res) => {
  const { query } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query missing.' });
  }

  // Guardrail check
  if (detectPromptInjection(query)) {
    return res.status(400).json({ 
      error: 'Security Warning: Input blocked. Prompt manipulation or injection keywords detected.' 
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.json({ 
      reply: `[SANDBOX MODE] I received: "${query}". (To enable full live AI planning, please insert your GEMINI_API_KEY in the server .env file).`,
      source: 'sandbox'
    });
  }

  const systemInstructions = `You are the Last-Minute Life Saver assistant. Analyze this query: "${query}"
  State current time is ${new Date().toISOString()}.
  Perform one of two actions:
  
  Action A (Create Task): If the user wants to add or schedule a task, extract the task details. You must respond with a JSON block inside the tag <task_data> containing:
  {
    "action": "create",
    "title": "Cleaned up task title",
    "hours_from_now": number,
    "quadrant": 1 (Do First), 2 (Schedule), 3 (Delegate), or 4 (Eliminate),
    "explanation": "Friendly assurance explaining why you placed it here."
  }
  
  Action B (Coaching): If the user is asking a productivity question, feeling stressed, or needs tips, respond with helpful, empathetic coaching.
  
  Format your reply in clear text paragraphs. If performing Action A, always include the <task_data>{JSON}</task_data> tag somewhere in your response.`;

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemInstructions }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 600 }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini response status: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.candidates[0].content.parts[0].text;
    return res.json({ reply, source: 'gemini' });
  } catch (error) {
    console.error("Gemini Proxy Error:", error);
    return res.json({ 
      reply: `I encountered an error connecting to Gemini. Let's record this: "${query}"`, 
      source: 'fallback_sandbox' 
    });
  }
});

// Wildcard fallback: serve index.html for frontend routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚨 Lifesaver AI Running at http://localhost:${PORT}`);
  console.log(`🔒 Secure API proxy and rate limiters active.`);
  console.log(`==================================================`);
});
