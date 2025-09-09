import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSign } from 'crypto';

// Modelos vigentes (Vertex). Fallback en orden.
const MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || '';
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const SA_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';

type GenerateQuestionsRequest = {
  topic: string; // puede estar vacío si useSeed=true
  count?: number;
  difficulty?: 'basica' | 'media' | 'avanzada';
  useSeed?: boolean;
  seed?: Array<{ texto: string; alternativas: string[]; correcta: string }>;
  seedLimit?: number;      // hasta 10
  topicFromSeed?: boolean; // inferir tema desde semillas
};

type GeneratedQuestionWire = {
  texto?: string;
  correct_answer?: string;
  incorrect_answers?: string[];
  enunciado?: string;
  correcta?: string;
  respuesta_correcta?: string;
  opciones?: string[];
  incorrectas?: string[];
  distractores?: string[];
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
      tags: { type: 'array', items: { type: 'string' } }
    },
    required: ['texto', 'correct_answer', 'incorrect_answers']
  },
  minItems: 1,
  maxItems: 5
};

function buildPromptBase(topic: string, count: number, difficulty: string) {
  return `Genera ${count} preguntas de opción múltiple en español neutro${topic ? ` sobre "${topic}"` : ''}. Dificultad: ${difficulty}.
Requisitos estrictos de formato:
- RESPONDE SOLO JSON (array) sin texto adicional ni explicaciones.
- Cada objeto: { "texto", "correct_answer", "incorrect_answers": [3], "tags": [] }.
- 1 sola correcta; 3 incorrectas plausibles.
- Enunciado claro (12–30 palabras), sin ambigüedades ni doble negación.
- Nada de bloques de código, cabeceras o comentarios.`.trim();
}

function addSeedGuideToPrompt(prompt: string, seeds: {texto:string; alternativas:string[]; correcta:string}[], inferredTopic: string | null) {
  const guideHeader = inferredTopic
    ? `\n\nTema inferido desde la guía: ${inferredTopic}.\nAlinea el estilo/registro/terminología con los siguientes ejemplos (no los repitas literalmente):\n`
    : `\n\nUsa la guía siguiente para alinear estilo/registro/terminología (no repitas literalmente):\n`;

  const examples = seeds.slice(0, 3).map((s, i) =>
    `Ejemplo ${i + 1}:\n- Enunciado: ${s.texto}\n- Alternativas: ${s.alternativas.join(' | ')}\n- Correcta: ${s.correcta}`
  ).join('\n');

  return prompt + guideHeader + examples;
}

function inferTopicFromSeeds(seeds: {texto:string; alternativas:string[]; correcta:string}[]): string {
  // extracción simple de keywords (ES) sin librerías
  const stop = new Set([
    'el','la','los','las','un','una','unos','unas','de','del','al','y','o','u','en','para','por','con',
    'se','que','qué','cual','cuál','cuáles','dónde','como','cómo','cuando','cuándo','porqué','porque',
    'es','son','a','su','sus','sus','lo','le','les','más','menos','muy','sobre','entre','hasta','desde',
    'este','esta','estos','estas','ese','esa','esos','esas','aquel','aquella','aquellos','aquellas',
    'qué','cuál','quién','quiénes','cuánto','cuánta','cuántos','cuántas','donde','cuando'
  ]);
  const text = seeds.map(s => `${s.texto}. ${s.correcta}. ${s.alternativas.join(' ')}`).join(' ');
  const tokens = text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // sin tildes
    .replace(/[^a-záéíóúñü0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter(t => t.length > 3 && !stop.has(t));
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
  const top = [...freq.entries()].sort((a,b) => b[1]-a[1]).slice(0, 6).map(e => e[0]);
  return top.join(', ');
}

function b64url(input: string | Buffer) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function getAccessToken(): Promise<string> {
  if (!SA_JSON) throw new Error('Falta GOOGLE_SERVICE_ACCOUNT_JSON');
  let creds: { client_email: string; private_key: string };
  try { creds = JSON.parse(SA_JSON); }
  catch { throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no es JSON válido'); }

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
  signer.update(unsigned); signer.end();
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

  if (!resp.ok) throw new Error(`Fallo access_token: ${resp.status} ${await resp.text()}`);
  const data = await resp.json() as { access_token: string };
  if (!data.access_token) throw new Error('Respuesta sin access_token');
  return data.access_token;
}

function extractAllTextParts(json: any): string {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p: any) => typeof p?.text === 'string' ? p.text : '')
    .filter(Boolean)
    .join('\n');
}

function tryParseArray(text: string): any[] {
  if (!text) return [];
  try { const v = JSON.parse(text); return Array.isArray(v) ? v : []; } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { const v = JSON.parse(fence[1].trim()); return Array.isArray(v) ? v : []; } catch {} }
  const first = text.indexOf('[');
  const last = text.lastIndexOf(']');
  if (first !== -1 && last !== -1 && last > first) {
    const slice = text.slice(first, last + 1);
    try { const v = JSON.parse(slice); return Array.isArray(v) ? v : []; } catch {}
  }
  try {
    const obj = JSON.parse(text);
    const arr = (obj && Array.isArray(obj.questions)) ? obj.questions : [];
    return arr;
  } catch {}
  return [];
}

function normalizeItems(raw: any[]): { texto: string; correct_answer: string; incorrect_answers: string[]; tags?: string[] }[] {
  return raw.map((q) => {
    const texto = (q.texto ?? q.enunciado ?? '').toString().trim();
    const correct =
      (q.correct_answer ?? q.correcta ?? q['respuesta_correcta'] ?? '').toString().trim();

    let incorrects: string[] = Array.isArray(q.incorrect_answers) ? q.incorrect_answers
                          : Array.isArray(q.incorrectas) ? q.incorrectas
                          : Array.isArray(q.distractores) ? q.distractores
                          : Array.isArray(q.opciones) ? q.opciones.filter((o: any) => o !== correct)
                          : [];
    incorrects = incorrects.map((s: any) => String(s)).filter(Boolean);
    if (correct && incorrects.length > 3) incorrects = incorrects.slice(0, 3);

    return { texto, correct_answer: correct, incorrect_answers: incorrects, tags: Array.isArray(q.tags) ? q.tags : [] };
  })
  .filter(q => q.texto && q.correct_answer && Array.isArray(q.incorrect_answers) && q.incorrect_answers.length === 3);
}

async function callModel(accessToken: string, model: string, prompt: string, temperature: number) {
  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${model}:generateContent`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      max_output_tokens: 1024,
      response_mime_type: 'application/json',
      response_schema: schema
    }
  };
  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!PROJECT || !LOCATION) return res.status(500).json({ error: 'Faltan GOOGLE_CLOUD_PROJECT / GOOGLE_CLOUD_LOCATION' });

  let payload: GenerateQuestionsRequest;
  try { payload = typeof req.body === 'object' ? req.body : JSON.parse(req.body as any); }
  catch { return res.status(400).json({ error: 'JSON inválido' }); }

  try {
    const accessToken = await getAccessToken();

    const count = Math.min(Math.max(payload.count ?? 3, 1), 5);
    const difficulty =
      payload.difficulty === 'avanzada' ? 'avanzada' :
      payload.difficulty === 'media' ? 'media' : 'básica';

    const seeds = Array.isArray(payload.seed) ? payload.seed.slice(0, Math.min(payload.seedLimit || 10, 10)) : [];
    const topicEmpty = !payload.topic || !payload.topic.trim();
    const shouldInfer = !!(payload.useSeed && seeds.length > 0 && (payload.topicFromSeed || topicEmpty));

    const inferred = shouldInfer ? inferTopicFromSeeds(seeds) : null;
    const topic = topicEmpty && inferred ? inferred : (payload.topic || '');

    let prompt = buildPromptBase(topic, count, difficulty);
    if (payload.useSeed && seeds.length > 0) {
      prompt = addSeedGuideToPrompt(prompt, seeds, inferred);
    }

    const temperature = payload.useSeed ? 0.3 : 0.7;

    let lastStatus = 0;
    let lastText = '';

    for (const model of MODEL_CANDIDATES) {
      const r = await callModel(accessToken, model, prompt, temperature);
      const status = r.status;
      const text = await r.text().catch(() => '');
      if (r.ok) {
        let data: any; try { data = JSON.parse(text); } catch { data = {}; }
        const rawText = extractAllTextParts(data);
        const arr = tryParseArray(rawText);
        const normalized = normalizeItems(arr);

        console.log(`[generate-questions] model=${model} items=${normalized.length} seed_count=${seeds.length} inferred="${inferred || ''}"`);
        return res.status(200).json(normalized);
      }
      lastStatus = status;
      lastText = text;
    }

    return res.status(lastStatus || 502).json({ error: 'Vertex AI error', details: lastText.slice(0, 2000) });
  } catch (e: any) {
    return res.status(500).json({ error: 'Fallo en generación', details: e?.message || String(e) });
  }
}
