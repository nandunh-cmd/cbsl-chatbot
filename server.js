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
export async function getCBSLAnswer(query) {
  try {
    // --- Step 1: Try fetching directly from CBSL ---
    console.log("🌐 Fetching CBSL site...");
    let res = await fetch(`https://www.cbsl.gov.lk/search?keys=${encodeURIComponent(query)}`);
    let html = await res.text();

    // --- Step 2: If fetch failed or response too small, use fallback ---
    if (!res.ok || html.length < 500) {
      console.warn("⚠️ CBSL direct fetch failed or empty, retrying via Jina AI relay...");
      const relayUrl = `https://r.jina.ai/http://www.cbsl.gov.lk/search?keys=${encodeURIComponent(query)}`;
      const relayRes = await fetch(relayUrl);
      if (relayRes.ok) {
        html = await relayRes.text();
      } else {
        console.error("❌ Fallback fetch also failed.");
        return "Sorry, unable to retrieve data from CBSL at the moment.";
      }
    }

    // --- Step 3: Summarize using OpenAI ---
    console.log("🤖 Sending content to OpenAI...");
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an assistant that extracts factual information from CBSL website text.",
        },
        {
          role: "user",
          content: `Extract or summarize relevant information for this query: "${query}". 
Here is the CBSL page text:\n\n${html}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 300,
    });

    const answer = completion.choices[0]?.message?.content?.trim() || "No relevant information found.";
    return answer;

  } catch (error) {
    console.error("💥 Error in getCBSLAnswer():", error);
    return "An error occurred while fetching CBSL data.";
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