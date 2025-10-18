        import express from "express";
        import fetch from "node-fetch";
        import sqlite3 from "sqlite3";
        import { open } from "sqlite";
        import { CONFIG } from "./config.js";
        import { fetchCbslData } from "./retriever.js";
        import { detectLanguage, translateText } from "./translator.js";
        // NOTE: This template uses the OpenAI npm package if you integrate AgentKit or direct API calls.
        // For demo purposes, the server returns a placeholder if OPENAI_API_KEY is not set.

        const app = express();
        app.use(express.json());
        const PORT = process.env.PORT || 3000;

        // Initialize lightweight SQLite logging
        const dbPromise = open({
          filename: "./logs/chatlogs.db",
          driver: sqlite3.Database
        });

        (async () => {
          const db = await dbPromise;
          await db.exec("CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, question TEXT, answer TEXT, lang TEXT, ts DATETIME DEFAULT CURRENT_TIMESTAMP)");
        })();

        app.get("/", (req, res) => {
          res.sendFile(new URL("./public/index.html", import.meta.url));
        });

        app.post("/api/ask", async (req, res) => {
          try {
            const userQuery = req.body.query || "";
            const lang = await detectLanguage(userQuery);
            // Fetch CBSL live content (lightweight snapshot)
            const cbslContent = await fetchCbslData();

            // Placeholder generation logic:
            // In production, replace this section with calls to AgentKit / OpenAI using retrieved context.
            let answerEnglish = `I searched the official CBSL site and found relevant information. (Demo answer)

Excerpt: ${cbslContent.slice(0,200)}...`;

            // If OPENAI_API_KEY is provided, one would call OpenAI here to craft a precise answer using cbslContent.
            if (process.env.OPENAI_API_KEY) {
              // Integrate AgentKit or direct OpenAI calls here.
              // For demo, we still use the placeholder text above.
            }

            const finalAnswer = (lang === "en") ? answerEnglish : await translateText(answerEnglish, lang);

            // Log the interaction
            const db = await dbPromise;
            await db.run("INSERT INTO logs (question, answer, lang) VALUES (?, ?, ?)", [userQuery, finalAnswer, lang]);

            res.json({ answer: finalAnswer });
          } catch (err) {
            console.error("Error /api/ask:", err);
            res.status(500).json({ error: "Internal Server Error" });
          }
        });

        app.get("/admin/logs", async (req, res) => {
          try {
            const db = await dbPromise;
            const rows = await db.all("SELECT * FROM logs ORDER BY ts DESC LIMIT 200");
            res.json(rows);
          } catch (e) {
            res.status(500).json({ error: "Unable to fetch logs" });
          }
        });

        app.listen(PORT, () => {
          console.log(`${CONFIG.botName} demo running on port ${PORT}`);
        });
