import fetch from "node-fetch";
// Very simple content fetcher for demo purposes.
// For production, replace with a robust crawler + vector store (Chroma / FAISS) + incremental updates.

const CBSL_BASE = process.env.CBSL_BASE_URL || "https://www.cbsl.gov.lk/";

export async function fetchCbslData() {
  try {
    const res = await fetch(CBSL_BASE);
    const html = await res.text();
    // crude strip of HTML tags (demo only)
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
                     .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                     .replace(/<[^>]+>/g, ' ')
                     .replace(/\s+/g, ' ')
                     .trim();
    return text.slice(0, 8000);
  } catch (err) {
    console.error("fetchCbslData error:", err);
    return "CBSL data unavailable at the moment.";
  }
}
