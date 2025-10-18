# CBSL Chatbot (Demo)

This is a Vercel-ready demo project for the "CBSL Virtual Assistant" — a multilingual chatbot (English, Sinhala, Tamil)
which demonstrates Retrieval + AgentKit-style workflow using OpenAI for prototyping.

## Quick start (local)
1. Copy `.env.example` to `.env` and add your `OPENAI_API_KEY`.
2. `npm install`
3. `npm start`
4. Open http://localhost:3000

## Deploy to Vercel
1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Set environment variable `OPENAI_API_KEY` in Vercel.
4. Deploy.

## Notes
- This demo fetches public pages from `cbsl.gov.lk` and extracts text minimally.
- The project uses a simple SQLite file `logs/chatlogs.db` for demo logging.
- Update `config.js` to change contact details without changing code.
