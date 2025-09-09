import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSign } from 'crypto';

// ====== Modelos y entorno ======
const MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || '';
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const SA_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';

// ====== Tipado payload ======
type GenerateQuestionsRequest = {
  topic?: string; // puede ir vacío si useSeed=true
  count?: number; // 1..5
  difficulty?: 'basica' | 'media' | 'avanzada';
  useSeed?: boolean;
  seed?: Array<{ texto: string; alternativas: string[]; correcta: string }>;
  seedLimit?: number;      // máx 10
  topicFromSeed?: boolean; // inferir tema (opcional)
};

// ====== Esquema JSON (igual al que ya funcionaba) ======
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

// ====== Prompt builders ======
function buildPromptBase(topic: string | undefined, count: number, difficulty: string) {
  const about = topic && topic.trim() ? ` sobre "${topic.trim()}"` : '';
  return `Genera ${count} preguntas de opción múltiple en español neutro${about}. Dificultad: ${difficulty}.
Requisitos estrictos de formato:
- RESPONDE SOLO JSON (array) sin texto adicional ni explicaciones.
- Cada objeto: { "texto", "correct_answer", "incorrect_answers": [3], "tags": [] }.
- 1 sola correcta; 3 incorrectas plausibles.
- Enunciado claro (12–30 palabras), sin ambigüedades ni doble negación.
- Nada de bloques de código, cabeceras o comentarios.`.trim();
}

function buildPromptSeedOnly(
  count: number,
  difficulty: string,
  seeds: {texto:string; alternativas:string[]; correcta:string}[]
) {
  const base = `Genera ${count} preguntas de opción múltiple en español neutro. Dificultad: ${difficulty}.
No hay un tema explícito. DEDUCE EL TEMA, el enfoque y la terminología a partir de los ejemplos de guía y genera PREGUNTAS NUEVAS del MISMO tema.
Responde SOLO un arreglo JSON. NADA de texto fuera del JSON.
Formato de cada objeto: { "texto", "correct_answer", "incorrect_answers": [3], "tags": [] } (3 incorrectas, plausibles).`;

  const examples = seeds.slice(0, 3).map((s, i) =>
    `Ejemplo ${i + 1}:\n- Enunciado: ${s.texto}\n- Alternativas: ${s.alternativas.join(' | ')}\n- Correcta: ${s.correcta}`
  ).join('\n');

  return `${base}\n\nGuía (ejemplos):\n${examples}`.trim();
}

function buildPromptSeedWithTopic(
  topic: string,
  count: number,
  difficulty: string,
  seeds: {texto:string; alternativas:string[]; correcta:string}[]
) {
  const base = buildPromptBase(topic, count, difficulty);
  const examples = seeds.slice(0, 3).map((s, i) =>
    `Ejemplo ${i + 1}:\n- Enunciado: ${s.texto}\n- Alternativas: ${s.alternativas.join(' | ')}\n- Correcta: ${s.correcta}`
  ).join('\n');
  return `${base}\n\nUsa la guía siguiente para alinear estilo/registro/terminología (NO repitas literalmente):\n${examples}`;
}

// ====== Auth ======
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

// ====== Extracción / parsing ======
function extractAllTextOrInlineJSON(json: any): { text: string; kinds: string[] } {
  const kinds: string[] = [];
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return { text: '', kinds };

  // inlineData JSON (preferido)
  const inline = parts.find((p: any) => p?.inlineData?.mimeType === 'application/json' && typeof p?.inlineData?.data === 'string');
  if (inline) {
    kinds.push('inlineData');
    try {
      const decoded = Buffer.from(inline.inlineData.data, 'base64').toString('utf8');
      return { text: decoded, kinds };
    } catch { /* ignore */ }
  }

  // texto
  const text = parts
    .map((p: any) => typeof p?.text === 'string' ? p.text : '')
    .filter(Boolean)
    .join('\n');
  if (text) kinds.push('text');

  return { text, kinds };
}

function stripFences(t: string) {
  return t.replace(/```(?:json)?/gi, '```').replace(/```/g, '');
}

function tryParseArray(text: string): any[] {
  if (!text) return [];
  // 1) JSON directo
  try { const v = JSON.parse(text); return Array.isArray(v) ? v : []; } catch {}
  // 2) ```json ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { const v = JSON.parse(fence[1].trim()); return Array.isArray(v) ? v : []; } catch {} }
  // 3) [ ... ] heurístico
  const first = text.indexOf('[');
  const last = text.lastIndexOf(']');
  if (first !== -1 && last !== -1 && last > first) {
    const slice = text.slice(first, last + 1);
    try { const v = JSON.parse(slice); return Array.isArray(v) ? v : []; } catch {}
  }
  // 4) objeto con .questions
  try {
    const obj = JSON.parse(text);
    const arr = (obj && Array.isArray(obj.questions)) ? obj.questions : [];
    if (arr.length) return arr;
  } catch {}
  // 5) heurística por bloques en texto libre
  return parseFromNaturalText(text);
}

// Heurística robusta para "Pregunta/Enunciado", "Opciones/Alternativas", "Correcta"
function parseFromNaturalText(text: string): any[] {
  const raw = stripFences(text).replace(/\r/g, '');
  const lines = raw.split('\n');

  type Block = { lines: string[] };
  const blocks: Block[] = [];
  let cur: Block | null = null;

  const startRe = /^(?:\s*\d+[\.\)]\s+|pregunta\b|enunciado\b)/i;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i].trim();
    if (!ln) continue;
    if (!cur || startRe.test(ln)) {
      if (cur && cur.lines.length) blocks.push(cur);
      cur = { lines: [] };
    }
    cur!.lines.push(ln);
  }
  if (cur && cur.lines.length) blocks.push(cur);

  const out: any[] = [];

  for (const b of blocks) {
    const txt = b.lines.join('\n');

    // Enunciado
    let enunciado = '';
    const en1 = txt.match(/(?:pregunta|enunciado)\s*[:.-]?\s*([\s\S]*?)(?:\n|$)/i);
    if (en1?.[1]) enunciado = en1[1].replace(/^\d+[\.\)]\s*/, '').trim();
    if (!enunciado) {
      const firstLine = b.lines[0].replace(/^\d+[\.\)]\s*/,'').trim();
      enunciado = firstLine;
    }

    // Opciones
    const opts: string[] = [];
    const optLineRe = /^(?:[-*•]\s*|[a-dA-D][\)\.]\s*)(.+)$/;
    for (const ln of b.lines) {
      const m = ln.match(optLineRe);
      if (m) {
        opts.push(m[1].trim().replace(/\s*\(correcta\)\s*$/i,'').replace(/^\*\s*/,''));
      }
    }
    // También aceptar opciones en bloque después de "Opciones/Alternativas:"
    if (!opts.length) {
      const after = txt.split(/(?:opciones|alternativas)\s*[:.-]?\s*/i)[1];
      if (after) {
        after.split('\n').forEach(l => {
          const m = l.trim().match(optLineRe);
          if (m) opts.push(m[1].trim().replace(/\s*\(correcta\)\s*$/i,'').replace(/^\*\s*/,''));
        });
        if (!opts.length) {
          after.split(/[;|]/).forEach(s => {
            const v = s.trim();
            if (v) opts.push(v.replace(/\s*\(correcta\)\s*$/i,''));
          });
        }
      }
    }

    // Correcta
    let correcta = '';
    const cor1 = txt.match(/(?:respuesta\s*correcta|correcta)\s*[:.-]?\s*([^\n]+)/i);
    if (cor1?.[1]) correcta = cor1[1].trim();
    if (!correcta && opts.length) {
      // marcada en opciones
      const mark = b.lines.find(l => /\(correcta\)/i.test(l));
      if (mark) {
        const m = mark.match(optLineRe);
        if (m) correcta = m[1].trim();
      } else {
        // a veces señalan con * la correcta
        const star = b.lines.find(l => /^\*\s*/.test(l));
        if (star) {
          const m = star.match(/^\*\s*(.+)$/);
          if (m) correcta = m[1].trim();
        }
      }
    }

    // Incorrectas
    let incorrectas: string[] = [];
    const incAfter = txt.split(/(?:incorrectas|distractores)\s*[:.-]?\s*/i)[1];
    if (incAfter) {
      incorrectas = incAfter.split(/[;|]/).map(s => s.trim()).filter(Boolean);
      if (!incorrectas.length) {
        incAfter.split('\n').forEach(l => {
          const m = l.trim().match(optLineRe);
          if (m) incorrectas.push(m[1].trim());
        });
      }
    }
    if (!incorrectas.length && opts.length && correcta) {
      incorrectas = opts.filter(o => o.toLowerCase() !== correcta.toLowerCase());
    }

    if (enunciado && correcta && incorrectas.length >= 3) {
      out.push({
        texto: enunciado,
        correct_answer: correcta,
        incorrect_answers: incorrectas.slice(0, 3)
      });
    }
  }

  return out;
}

function normalizeItems(raw: any[]) {
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

// ====== Safety: permisivo para contenido educativo ======
const safetySettings = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
];

// ====== Llamada a Vertex (config snake_case + schema) ======
async function callModel(
  accessToken: string,
  model: string,
  prompt: string,
  temperature: number
) {
  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${model}:generateContent`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    safetySettings,
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

// ====== Handler ======
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!PROJECT || !LOCATION) return res.status(500).json({ error: 'Faltan GOOGLE_CLOUD_PROJECT / GOOGLE_CLOUD_LOCATION' });

  let p: GenerateQuestionsRequest;
  try { p = typeof req.body === 'object' ? (req.body as any) : JSON.parse(req.body as any); }
  catch { return res.status(400).json({ error: 'JSON inválido' }); }

  try {
    const accessToken = await getAccessToken();

    const count = Math.min(Math.max(p.count ?? 3, 1), 5);
    const difficulty =
      p.difficulty === 'avanzada' ? 'avanzada' :
      p.difficulty === 'media' ? 'media' : 'básica';

    const seedsAll = Array.isArray(p.seed) ? p.seed : [];
    const seeds = seedsAll.slice(0, Math.min(p.seedLimit || 10, 10));
    const topicIsEmpty = !p.topic || !p.topic.trim();

    // —— Selección de prompt/temperatura (incluye el caso problemático)
    let prompt: string;
    let temp = 0.7;
    let mode = 'normal';

    if (p.useSeed && seeds.length > 0 && topicIsEmpty) {
      prompt = buildPromptSeedOnly(count, difficulty, seeds);
      temp = 0.25; // más obediente a la guía
      mode = 'seed-only';
    } else if (p.useSeed && seeds.length > 0 && !topicIsEmpty) {
      prompt = buildPromptSeedWithTopic(p.topic!.trim(), count, difficulty, seeds);
      temp = 0.3;
      mode = 'seed+topic';
    } else {
      prompt = buildPromptBase(p.topic?.trim(), count, difficulty);
      temp = 0.7;
      mode = 'topic-or-generic';
    }

    let lastStatus = 0;
    let lastText = '';

    for (const model of MODEL_CANDIDATES) {
      const r = await callModel(accessToken, model, prompt, temp);
      const status = r.status;
      const text = await r.text().catch(() => '');

      if (r.ok) {
        let data: any; try { data = JSON.parse(text); } catch { data = {}; }
        const { text: raw, kinds } = extractAllTextOrInlineJSON(data);

        // 1) Intentar JSON directo
        let arr = tryParseArray(raw);
        // 2) Si nada, reintentar con versión “limpia” (sin fences)
        if (!arr.length && raw) arr = tryParseArray(stripFences(raw));

        const normalized = normalizeItems(arr);

        console.log(`[generate-questions] model=${model} mode=${mode} items=${normalized.length} parts=${kinds.join('+') || 'none'} raw_len=${(raw||'').length} seeds=${seeds.length}`);

        return res.status(200).json(normalized);
      }

      lastStatus = status;
      lastText = text;
    }

    return res.status(lastStatus || 502).json({ error: 'Vertex AI error', details: lastText.slice(0, 1200) });
  } catch (e: any) {
    return res.status(500).json({ error: 'Fallo en generación', details: e?.message || String(e) });
  }
}
