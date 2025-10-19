import express from "express";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { open } from "sqlite";
import sqlite3 from "sqlite3";
import os from "os";
import { config } from "dotenv";
import OpenAI from "openai";

config();

const app = express();
const port = process.env.PORT || 3000;

// ---- PATH FIX (for Vercel ES modules) ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---- SQLITE SETUP (Vercel writable /tmp directory) ----
const dbPath = join(os.tmpdir(), "chatlogs.db");
const dbPromise = open({
  filename: dbPath,
  driver: sqlite3.Database
});

await (async () => {
  const db = await dbPromise;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS chatlogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT,
      userQuery TEXT,
      botResponse TEXT,
      language TEXT
    )
  `);
})();

// ---- OPENAI SETUP ----
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ---- HELPERS ----
function cleanText(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/Skip to main content/gi, "")
    .replace(/Search form/gi, "")
    .replace(/Search Navigation/gi, "")
    .replace(/English සිංහල தமிழ்/gi, "")
    .replace(/About the Bank.*/gi, "")
    .trim();
}

async function detectLanguage(text) {
  if (/[අ-ෆ]/.test(text)) return "si"; // Sinhala
  if (/[அ-ஹ]/.test(text)) return "ta"; // Tamil
  return "en"; // Default English
}

async function translateText(text, targetLang) {
  if (targetLang === "en") return text;
  const translation = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: `Translate this into ${targetLang === "si" ? "Sinhala" : "Tamil"}.` },
      { role: "user", content: text }
    ]
  });
  return translation.choices[0].message.content;
}

// ---- FETCH CONTENT FROM CBSL ----
async function getCBSLAnswer(query) {
  try {
    const searchUrl = `https://www.cbsl.gov.lk/search?keys=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, { timeout: 15000 });
    
    if (!res.ok) {
      console.error("Fetch failed:", res.status);
      return "I could not access the CBSL official website at this moment. Please try again later.";
    }

    const html = await res.text();
    const cleaned = cleanText(html);

    // If there's no meaningful content, stop early
    if (!cleaned || cleaned.length < 200) {
      return "I could not find official CBSL information on that topic. Please contact a CBSL officer for clarification.";
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are CBSL Virtual Assistant. Answer only using verified information from CBSL website content provided. If unclear or unrelated, politely say you couldn’t find relevant information."
        },
        {
          role: "user",
          content: `CBSL official website content:\n${cleaned}\n\nQuestion: ${query}`
        }
      ],
      temperature: 0.3
    });

    return completion.choices[0].message.content.trim();

  } catch (err) {
    console.error("Error fetching CBSL answer:", err);
    return "I’m sorry, I encountered an issue retrieving official CBSL information. Please try again or contact a CBSL officer.";
  }
}


// ---- ROUTES ----
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "public", "index.html"));
});

app.post("/chat", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.json({ text: "Please enter a question." });

    const lang = await detectLanguage(query);
    let answer = await getCBSLAnswer(query);

    if (lang !== "en") {
      answer = await translateText(answer, lang);
    }

    const db = await dbPromise;
    await db.run(
      `INSERT INTO chatlogs (timestamp, userQuery, botResponse, language)
       VALUES (?, ?, ?, ?)`,
      [new Date().toISOString(), query, answer, lang]
    );

    res.json({
      text: answer,
      source: "CBSL Official Website",
      lang
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({
      text: "An internal error occurred. Please contact a CBSL officer.",
      error: err.message
    });
  }
});

// ---- START SERVER ----
app.listen(port, () => {
  console.log(`CBSL Virtual Assistant running on port ${port}`);
});