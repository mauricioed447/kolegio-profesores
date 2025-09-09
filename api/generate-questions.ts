import type { VercelRequest, VercelResponse } from '@vercel/node';

const MODEL = 'gemini-1.5-flash';
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || '';
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const API_KEY = process.env.GEMINI_API_KEY || '';

type GenerateQuestionsRequest = {
  topic: string;
  count?: number; // 1-5
  difficulty?: 'basica' | 'media' | 'avanzada';
  useSeed?: boolean;
  seed?: Array<{
    texto: string;
    alternativas: string[];
    correcta: string;
  }>;
};

type GeneratedQuestion = {
  texto: string;
  correct_answer: string;
  incorrect_answers: string[];
  tags?: string[];
};

const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      texto: { type: 'string' },
      correct_answer: { type: 'string' },
      incorrect_answers: {
        type: 'array',
        items: { type: 'string' },
        minItems: 3,
        maxItems: 3
      },
      tags: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: ['texto', 'correct_answer', 'incorrect_answers']
  },
  minItems: 1,
  maxItems: 5
};

function buildPrompt(payload: GenerateQuestionsRequest) {
  const count = Math.min(Math.max(payload.count ?? 3, 1), 5);
  const difficulty =
    payload.difficulty === 'avanzada' ? 'avanzada' :
    payload.difficulty === 'media' ? 'media' : 'básica';

  const seedTxt = (payload.useSeed && payload.seed && payload.seed.length)
    ? `\n\nGuía de estilo y nivel (ejemplos):\n${payload.seed.slice(0, 5).map((s, i) =>
      `Ejemplo ${i + 1}:\n- Enunciado: ${s.texto}\n- Alternativas: ${s.alternativas.join(' | ')}\n- Correcta: ${s.correcta}`
    ).join('\n')}\n`
    : '';

  return `Crea ${count} preguntas de opción múltiple en español neutro sobre el tema "${payload.topic}". Dificultad: ${difficulty}.
Requisitos:
- Devuelve SOLO JSON (array) con objetos { "texto", "correct_answer", "incorrect_answers": [3], "tags": [] }.
- 1 sola correcta; 3 incorrectas plausibles.
- Enunciado claro (12–30 palabras); sin ambigüedades ni doble negación.
- Evita marcas comerciales y contenidos sensibles.
${seedTxt}`.trim();
}

function parseVertexResponse(json: any): GeneratedQuestion[] {
  // Vertex AI: candidates[0].content.parts[0].text → JSON string
  const txt = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!txt || typeof txt !== 'string') return [];
  try {
    const arr = JSON.parse(txt);
    if (Array.isArray(arr)) return arr as GeneratedQuestion[];
    return [];
  } catch {
    return [];
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  if (!API_KEY || !PROJECT || !LOCATION) {
    res.status(500).json({ error: 'Faltan variables de entorno: GEMINI_API_KEY / GOOGLE_CLOUD_PROJECT / GOOGLE_CLOUD_LOCATION' });
    return;
  }

  let payload: GenerateQuestionsRequest;
  try {
    payload = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body as any);
  } catch {
    res.status(400).json({ error: 'JSON inválido' });
    return;
  }

  const prompt = buildPrompt(payload);

  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent?key=${encodeURIComponent(API_KEY)}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
      responseSchema: schema
    }
  };

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const err = await r.text().catch(() => '');
      res.status(r.status).json({ error: 'Vertex AI error', details: err.slice(0, 2000) });
      return;
    }

    const data = await r.json();
    const items = parseVertexResponse(data);

    const normalized = (items || []).map((q) => ({
      texto: String(q.texto || '').trim(),
      correct_answer: String(q.correct_answer || '').trim(),
      incorrect_answers: Array.isArray(q.incorrect_answers) ? q.incorrect_answers.slice(0, 3).map(String) : [],
      tags: Array.isArray(q.tags) ? q.tags.map(String) : []
    })).filter(q => q.texto && q.correct_answer && q.incorrect_answers.length === 3);

    res.status(200).json(normalized);
  } catch (e: any) {
    res.status(500).json({ error: 'Fallo al llamar a Vertex AI', details: e?.message || String(e) });
  }
}
