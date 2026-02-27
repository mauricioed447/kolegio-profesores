// RUTA EN TU REPO: api/generate-questions.ts
// ACCIÓN: REEMPLAZAR el archivo existente

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Dificultad = 'Superficial' | 'Medio' | 'Profundo' | 'Auto';

type GenerateRequest = {
  codigo_oa: string;
  dificultad: Dificultad;
  cantidad: number;
  es_adicional?: boolean;
};

type OAData = {
  codigo: string;
  descripcion: string;
  basal: boolean;
  palabras_clave: string[];
  proposito_unidad: string;
  indicadores: string;
};

type PreguntaGenerada = {
  Pregunta: string;
  Respuesta1: string;
  Respuesta2: string;
  Respuesta3: string;
  Respuesta4: string;
  'Mensaje Correcto': string;
  'Mensaje Incorrecto': string;
  imagen_requerida: false;
  imagen_descripcion: string | null;
  nivel_bloom: string;
  dificultad: string;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const MAX_CANTIDAD = 10;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

const RECURSOS_CON_IMAGEN = new Set([
  'interpretación de figura',
  'interpretación de tabla',
  'interpretación de diagrama',
  'interpretación de mapa',
]);

// ─── Lectura del JSON V3 ──────────────────────────────────────────────────────

let cachedV3: any = null;

function getV3(): any {
  if (cachedV3) return cachedV3;
  const filePath = join(__dirname, '_data', 'oas_maestro_v3.json');
  cachedV3 = JSON.parse(readFileSync(filePath, 'utf-8'));
  return cachedV3;
}

type OAContext = {
  oa: OAData;
  grado: string;
  asignatura: string;
  eje: string;
};

function findOA(codigo: string): OAContext | null {
  const v3 = getV3();

  for (const [gradoNombre, gradoData] of Object.entries(v3.grados as Record<string, any>)) {
    for (const [asigNombre, asigData] of Object.entries(gradoData.asignaturas as Record<string, any>)) {

      // Asignaturas con ejes
      if (asigData.tiene_ejes && asigData.ejes) {
        for (const [ejeNombre, ejeData] of Object.entries(asigData.ejes as Record<string, any>)) {
          if (ejeData?.objetivos?.[codigo]) {
            return { oa: ejeData.objetivos[codigo], grado: gradoNombre, asignatura: asigNombre, eje: ejeNombre };
          }
        }
      }
      // Asignaturas con módulos
      else if (asigData.tiene_modulos && asigData.modulos) {
        for (const [modNombre, modData] of Object.entries(asigData.modulos as Record<string, any>)) {
          if (modData?.objetivos?.[codigo]) {
            return { oa: modData.objetivos[codigo], grado: gradoNombre, asignatura: asigNombre, eje: modNombre };
          }
        }
      }
      // Asignaturas sin ejes
      else if (asigData.objetivos?.[codigo]) {
        return { oa: asigData.objetivos[codigo], grado: gradoNombre, asignatura: asigNombre, eje: '' };
      }
    }
  }

  return null;
}

function getTaxonomiaAsig(asignatura: string): any {
  const v3 = getV3();
  // La taxonomía está embebida en cada asignatura del V3
  for (const gradoData of Object.values(v3.grados as Record<string, any>)) {
    const asigData = gradoData.asignaturas?.[asignatura];
    if (asigData?.taxonomia) return asigData.taxonomia;
  }
  return null;
}

// ─── Helpers de construcción de prompt ───────────────────────────────────────

function getRecursosValidos(taxAsig: any, dificultad: string): string[] {
  if (!taxAsig) return ['pregunta directa'];

  if (dificultad === 'Auto') {
    const todos = new Set<string>();
    for (const recursos of Object.values(taxAsig.recursos_por_dificultad as Record<string, string[]>)) {
      recursos.forEach((r) => todos.add(r));
    }
    return Array.from(todos).filter((r) => !RECURSOS_CON_IMAGEN.has(r));
  }

  const recursos: string[] = taxAsig.recursos_por_dificultad?.[dificultad] ?? ['pregunta directa'];
  return recursos.filter((r) => !RECURSOS_CON_IMAGEN.has(r));
}

function buildDistribucion(taxAsig: any, cantidad: number): Record<string, number> {
  const dist = taxAsig?.distribucion_dificultad_recomendada ?? { Superficial: 35, Medio: 45, Profundo: 20 };
  const superficial = Math.round((dist.Superficial / 100) * cantidad);
  const profundo    = Math.round((dist.Profundo    / 100) * cantidad);
  const medio       = cantidad - superficial - profundo;
  return {
    Superficial: Math.max(superficial, 0),
    Medio:       Math.max(medio,       0),
    Profundo:    Math.max(profundo,    0),
  };
}

function buildSystemPrompt(): string {
  return `Eres un experto en diseño de evaluaciones educativas para el sistema escolar chileno (currículum MINEDUC).
Generas preguntas de selección múltiple de alta calidad, alineadas a los Objetivos de Aprendizaje oficiales.
Usas la Taxonomía de Bloom para asegurar el nivel cognitivo correcto.
Respondes ÚNICAMENTE con un JSON array válido. Sin texto adicional. Sin bloques markdown. Sin explicaciones.
IMPORTANTE: Nunca uses notación LaTeX ($...$, $$...$$). Expresa las fórmulas matemáticas en texto plano:
- Usa ^ para potencias: x^2, ax^2 + bx + c
- Usa / para fracciones: 3/4, (a+b)/(c-d)
- Usa sqrt() para raíces: sqrt(x), sqrt(x^2 + y^2)
- Usa != para distinto de, <= para menor o igual, >= para mayor o igual
- Ejemplo correcto: f(x) = ax^2 + bx + c (a != 0)`;
}

function buildUserPrompt(
  ctx: OAContext,
  dificultad: Dificultad,
  cantidad: number,
  taxAsig: any,
  recursosValidos: string[],
  distribucion: Record<string, number> | null
): string {
  const v3 = getV3();
  const bloom = v3.bloom_dificultad?.niveles ?? {};
  const notaEspecial = taxAsig?.nota_especial ? `\nNOTA ESPECIAL: ${taxAsig.nota_especial}` : '';

  const instrDistribucion = distribucion
    ? `DISTRIBUCIÓN REQUERIDA: ${distribucion.Superficial} Superficial, ${distribucion.Medio} Medio, ${distribucion.Profundo} Profundo.`
    : `DIFICULTAD: Todas las preguntas deben ser nivel "${dificultad}".
Nivel Bloom: ${bloom[dificultad]?.bloom?.join(', ') ?? ''}
Verbos clave: ${bloom[dificultad]?.verbos_clave?.join(', ') ?? ''}
Característica: ${bloom[dificultad]?.caracteristica ?? ''}`;

  const indicadores = ctx.oa.indicadores
    ? `\nINDICADORES DE EVALUACIÓN:\n${ctx.oa.indicadores}`
    : '';

  const palabrasClave = ctx.oa.palabras_clave?.length
    ? `\nPALABRAS CLAVE DEL DOMINIO:\n${ctx.oa.palabras_clave.join(', ')}`
    : '';

  const proposito = ctx.oa.proposito_unidad
    ? `\nPROPÓSITO DE LA UNIDAD:\n${ctx.oa.proposito_unidad}`
    : '';

  const ejeInfo = ctx.eje ? `\nEJE / MÓDULO: ${ctx.eje}` : '';

  return `Genera ${cantidad} preguntas de selección múltiple para el siguiente contexto curricular:

GRADO: ${ctx.grado}
ASIGNATURA: ${ctx.asignatura}${ejeInfo}
OBJETIVO DE APRENDIZAJE: ${ctx.oa.codigo}
DESCRIPCIÓN OA: ${ctx.oa.descripcion}${indicadores}${palabrasClave}${proposito}

${instrDistribucion}

RECURSOS PERMITIDOS (sin imagen): ${recursosValidos.join(', ')}${notaEspecial}

REGLAS OBLIGATORIAS:
- 4 alternativas por pregunta (1 correcta, 3 incorrectas plausibles)
- Los distractores deben representar errores conceptuales reales y comunes, NO respuestas absurdas
- Usa contextos y ejemplos apropiados para estudiantes chilenos cuando sea pertinente
- No repitas el mismo concepto en dos preguntas del lote
- Para "comprensión de texto": incluye el fragmento textual DENTRO del campo Pregunta, antes de la pregunta
- Para "cálculo y fórmula": usa texto plano (x^2, sqrt(), !=) NUNCA LaTeX

FORMATO DE SALIDA — devuelve SOLO este JSON array, sin nada más:
[
  {
    "Pregunta": "enunciado completo de la pregunta",
    "Respuesta1": "respuesta CORRECTA",
    "Respuesta2": "alternativa incorrecta",
    "Respuesta3": "alternativa incorrecta",
    "Respuesta4": "alternativa incorrecta",
    "Mensaje Correcto": "feedback positivo breve (ej: ¡Muy bien!)",
    "Mensaje Incorrecto": "La respuesta correcta es [Respuesta1]. [explicación breve en 1-2 oraciones de por qué es correcta]",
    "imagen_requerida": false,
    "imagen_descripcion": null,
    "nivel_bloom": "recordar|comprender|aplicar|analizar|evaluar",
    "dificultad": "Superficial|Medio|Profundo"
  }
]`;
}

// ─── Parsing y validación ─────────────────────────────────────────────────────

function tryParseArray(text: string): any[] {
  if (!text) return [];
  try { const v = JSON.parse(text); return Array.isArray(v) ? v : []; } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try { const v = JSON.parse(fence[1].trim()); return Array.isArray(v) ? v : []; } catch {}
  }
  const first = text.indexOf('[');
  const last  = text.lastIndexOf(']');
  if (first !== -1 && last > first) {
    try { const v = JSON.parse(text.slice(first, last + 1)); return Array.isArray(v) ? v : []; } catch {}
  }
  return [];
}

function validateQuestion(q: any): q is PreguntaGenerada {
  return (
    typeof q?.Pregunta    === 'string' && q.Pregunta.length    > 0 &&
    typeof q?.Respuesta1  === 'string' && q.Respuesta1.length  > 0 &&
    typeof q?.Respuesta2  === 'string' &&
    typeof q?.Respuesta3  === 'string' &&
    typeof q?.Respuesta4  === 'string' &&
    typeof q?.['Mensaje Correcto']   === 'string' &&
    typeof q?.['Mensaje Incorrecto'] === 'string'
  );
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Falta DEEPSEEK_API_KEY en variables de entorno' });

  let payload: GenerateRequest;
  try {
    payload = typeof req.body === 'object' ? req.body : JSON.parse(req.body as any);
  } catch {
    return res.status(400).json({ error: 'JSON inválido en el body' });
  }

  const { codigo_oa, dificultad, cantidad, es_adicional } = payload;

  if (!codigo_oa || !dificultad) {
    return res.status(400).json({ error: 'Faltan campos requeridos: codigo_oa y dificultad' });
  }

  const cantidadFinal = Math.min(Math.max(Number(cantidad) || 5, 1), es_adicional ? 5 : MAX_CANTIDAD);

  const ctx = findOA(codigo_oa);
  if (!ctx) return res.status(404).json({ error: `OA no encontrado: ${codigo_oa}` });

  const taxAsig       = getTaxonomiaAsig(ctx.asignatura);
  const recursosValidos = getRecursosValidos(taxAsig, dificultad);
  const distribucion    = dificultad === 'Auto'
    ? buildDistribucion(taxAsig, cantidadFinal)
    : null;

  const systemPrompt = buildSystemPrompt();
  const userPrompt   = buildUserPrompt(ctx, dificultad, cantidadFinal, taxAsig, recursosValidos, distribucion);

  const callDeepSeek = async (messages: any[], temperature = 0.7) => {
    return fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages,
        temperature,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });
  };

  try {
    const response = await callDeepSeek([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ]);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return res.status(502).json({ error: 'Error de DeepSeek API', details: errText.slice(0, 500) });
    }

    const data = await response.json();
    const rawContent = data?.choices?.[0]?.message?.content ?? '';

    let parsed: any[] = tryParseArray(rawContent);
    if (!parsed.length) {
      try {
        const obj = JSON.parse(rawContent);
        const key = Object.keys(obj).find((k) => Array.isArray(obj[k]));
        if (key) parsed = obj[key];
      } catch {}
    }

    const validadas = parsed.filter(validateQuestion);

    if (!validadas.length) {
      // Retry
      const retryResponse = await callDeepSeek([
        { role: 'system',    content: systemPrompt },
        { role: 'user',      content: userPrompt   },
        { role: 'assistant', content: rawContent   },
        { role: 'user',      content: 'Tu respuesta anterior no era un JSON array válido con el formato solicitado. Responde ÚNICAMENTE con el JSON array, sin ningún texto adicional ni envoltura.' },
      ], 0.5);

      if (retryResponse.ok) {
        const retryData    = await retryResponse.json();
        const retryContent = retryData?.choices?.[0]?.message?.content ?? '';
        const retryParsed  = tryParseArray(retryContent).filter(validateQuestion);
        if (retryParsed.length) return res.status(200).json(retryParsed);
      }

      return res.status(422).json({
        error: 'La IA no generó preguntas en el formato esperado. Intenta de nuevo.',
        debug: rawContent.slice(0, 300),
      });
    }

    return res.status(200).json(validadas);

  } catch (e: any) {
    return res.status(500).json({ error: 'Error interno', details: e?.message });
  }
}
