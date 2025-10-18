        import OpenAI from "openai";
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

        export async function detectLanguage(text) {
          if (!text) return "en";
          // Simple script: check for Sinhala/Tamil characters — crude but fast for demo.
          const sinhala = /[\u0D80-\u0DFF]/;
          const tamil = /[\u0B80-\u0BFF]/;
          if (sinhala.test(text)) return "si";
          if (tamil.test(text)) return "ta";
          return "en";
        }

        export async function translateText(text, targetLang) {
          // For demo: if no API key, return a simple note. In production, call an LLM or translation API.
          if (!process.env.OPENAI_API_KEY) {
            return `[Translated to ${targetLang} — demo mode]
\n${text}`;
          }
          // Use OpenAI chat completions for translation (replace with preferred translator in production)
          const prompt = `Translate the following text into ${targetLang === 'si' ? 'Sinhala' : targetLang === 'ta' ? 'Tamil' : 'English' } in a formal, professional banking tone:\n\n${text}`;
          const resp = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are a professional translator." },
              { role: "user", content: prompt }
            ]
          });
          return resp.choices?.[0]?.message?.content || text;
        }
