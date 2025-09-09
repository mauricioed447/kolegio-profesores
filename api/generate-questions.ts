import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSign } from 'crypto';

const MODEL = 'gemini-1.5-flash';
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || '';
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const SA_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';

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
    ? `\n\nGuía (ejemplos):\n${payload.seed.slice(0, 5).map((s, i) =>
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

function b64url(input: string | Buffer) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function getAccessToken(): Promise<string> {
  if (!SA_JSON) throw new Error('Falta GOOGLE_SERVICE_ACCOUNT_JSON');
  let creds: { client_email: string; private_key: string };
  try {
    creds = JSON.parse(SA_JSON);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no es JSON válido');
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = b64url(signer.sign(creds.private_key));
  const assertion = `${unsigned}.${signature}`;

  const form = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Fallo al obtener access_token: ${resp.status} ${txt.slice(0, 2000)}`);
  }
  const data = await resp.json() as { access_token: string };
  if (!data.access_token) throw new Error('Respuesta sin access_token');
  return data.access_token;
}

function parseVertexResponse(json: any): GeneratedQuestion[] {
  const txt = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!txt || typeof txt !== 'string') return [];
  try {
    const arr = JSON.parse(txt);
    return Array.isArray(arr) ? arr as GeneratedQuestion[] : [];
  } catch {
    return [];
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  if (!PROJECT || !LOCATION) {
    res.status(500).json({ error: 'Faltan variables: GOOGLE_CLOUD_PROJECT / GOOGLE_CLOUD_LOCATION' });
    return;
  }

  let payload: GenerateQuestionsRequest;
  try {
    payload = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body as any);
  } catch {
    res.status(400).json({ error: 'JSON inválido' });
    return;
  }

  try {
    const accessToken = await getAccessToken();
    const prompt = buildPrompt(payload);

    const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`;

    const body = {
      contents: [
        { role: 'user', parts: [{ text: prompt }] }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        responseSchema: schema
      }
    };

    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(body),
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
    res.status(500).json({ error: 'Fallo en generación', details: e?.message || String(e) });
  }
}
