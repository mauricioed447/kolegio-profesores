// RUTA EN TU REPO: api/generate-questions.ts
// ACCIÓN: REEMPLAZAR el archivo existente

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

// ─── Tipos internos ────────────────────────────────────────────────────────────

type Dificultad = 'Superficial' | 'Medio' | 'Profundo' | 'Auto';

type GenerateRequest = {
  codigo_oa: string;
  dificultad: Dificultad;
  cantidad: number;
  es_adicional?: boolean;
  ids_existentes?: string[];
};

type OA = {
  codigo: string;
  unidad: string;
  descripcion: string;
  indicadores: string[];
  palabras_clave: string[];
  proposito_unidad: string;
  asignatura: string;
  grado: string;
  preguntas_ejemplo: Array<{
    enunciado: string;
    respuesta: string;
    tiene_imagen: boolean;
    dificultad: string;
  }>;
};

type TaxonomiaAsignatura = {
  recursos_por_dificultad: Record<string, string[]>;
  distribucion_dificultad_recomendada: Record<string, number>;
  nota_especial?: string;
};

type Taxonomia = {
  bloom_dificultad: {
    niveles: Record<string, {
      bloom: string[];
      descripcion: string;
      verbos_clave: string[];
      caracteristica: string;
    }>;
  };
  asignaturas: Record<string, TaxonomiaAsignatura>;
  instrucciones_recursos: Record<string, { imagen_requerida: boolean; instruccion_ia?: string }>;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOA(codigo: string): OA | null {
  const filePath = join(__dirname, '_data', 'oas_maestro_final.json');
  const data = JSON.parse(readFileSync(filePath, 'utf-8')) as { objetivos: OA[] };
  return data.objetivos.find((o) => o.codigo === codigo) ?? null;
}

function getTaxonomia(): Taxonomia {
  const filePath = join(__dirname, '_data', 'taxonomia_preguntas.json');
  return JSON.parse(readFileSync(filePath, 'utf-8')) as Taxonomia;
}

function getRecursosValidos(taxonomia: Taxonomia, asignatura: string, dificultad: string): string[] {
  const taxAsig = taxonomia.asignaturas[asignatura];
  if (!taxAsig) return ['pregunta directa'];

  if (dificultad === 'Auto') {
    const todos = new Set<string>();
    for (const recursos of Object.values(taxAsig.recursos_por_dificultad)) {
      recursos.forEach((r) => todos.add(r));
    }
    return Array.from(todos).filter((r) => !RECURSOS_CON_IMAGEN.has(r));
  }

  const recursos = taxAsig.recursos_por_dificultad[dificultad] ?? ['pregunta directa'];
  return recursos.filter((r) => !RECURSOS_CON_IMAGEN.has(r));
}

function buildDistribucion(taxonomia: Taxonomia, asignatura: string, cantidad: number): Record<string, number> {
  const taxAsig = taxonomia.asignaturas[asignatura];
  const dist = taxAsig?.distribucion_dificultad_recomendada ?? { Superficial: 35, Medio: 45, Profundo: 20 };
  const superficial = Math.round((dist.Superficial / 100) * cantidad);
  const profundo = Math.round((dist.Profundo / 100) * cantidad);
  const medio = cantidad - superficial - profundo;
  return {
    Superficial: Math.max(superficial, 0),
    Medio: Math.max(medio, 0),
    Profundo: Math.max(profundo, 0),
  };
}

function buildSystemPrompt(): string {
  return `Eres un experto en diseño de evaluaciones educativas para el sistema escolar chileno (currículum MINEDUC).
Generas preguntas de selección múltiple de alta calidad, alineadas a los Objetivos de Aprendizaje oficiales.
Usas la Taxonomía de Bloom para asegurar el nivel cognitivo correcto.
Respondes ÚNICAMENTE con un JSON array válido. Sin texto adicional. Sin bloques markdown. Sin explicaciones.`;
}

function buildUserPrompt(
  oa: OA,
  dificultad: Dificultad,
  cantidad: number,
  taxonomia: Taxonomia,
  recursosValidos: string[],
  distribucion: Record<string, number> | null
): string {
  const bloom = taxonomia.bloom_dificultad.niveles;
  const taxAsig = taxonomia.asignaturas[oa.asignatura];
  const notaEspecial = taxAsig?.nota_especial ? `\nNOTA ESPECIAL: ${taxAsig.nota_especial}` : '';

  const ejemplos = (oa.preguntas_ejemplo || [])
    .filter((e) => !e.tiene_imagen)
    .slice(0, 3)
    .map((e, i) => `Ejemplo ${i + 1} (${e.dificultad}):\n  Enunciado: ${e.enunciado}\n  Respuesta: ${e.respuesta}`)
    .join('\n');

  const instrDistribucion = distribucion
    ? `DISTRIBUCIÓN REQUERIDA: ${distribucion.Superficial} Superficial, ${distribucion.Medio} Medio, ${distribucion.Profundo} Profundo.`
    : `DIFICULTAD: Todas las preguntas deben ser nivel "${dificultad}".
Nivel Bloom: ${bloom[dificultad]?.bloom.join(', ')}
Verbos clave: ${bloom[dificultad]?.verbos_clave.join(', ')}
Característica: ${bloom[dificultad]?.caracteristica}`;

  return `Genera ${cantidad} preguntas de selección múltiple para el siguiente contexto curricular:

GRADO: ${oa.grado}
ASIGNATURA: ${oa.asignatura}
UNIDAD: ${oa.unidad}
OBJETIVO DE APRENDIZAJE: ${oa.codigo}
DESCRIPCIÓN OA: ${oa.descripcion}

INDICADORES DE EVALUACIÓN:
${oa.indicadores.join('\n')}

PALABRAS CLAVE DEL DOMINIO:
${oa.palabras_clave.join(', ')}

${instrDistribucion}

RECURSOS PERMITIDOS (sin imagen): ${recursosValidos.join(', ')}
${notaEspecial}

REGLAS OBLIGATORIAS:
- 4 alternativas por pregunta (1 correcta, 3 incorrectas plausibles)
- Los distractores deben representar errores conceptuales reales y comunes, NO respuestas absurdas
- Usa contextos y ejemplos chilenos cuando sea pertinente
- No repitas el mismo concepto en dos preguntas del lote
- Para "comprensión de texto": incluye el fragmento textual DENTRO del campo Pregunta, antes de la pregunta
- Para "cálculo y fórmula": usa LaTeX inline con $...$ para expresiones matemáticas${ejemplos ? `\n\nEJEMPLOS DE REFERENCIA DEL BANCO MINEDUC (guía de formato y nivel, NO copiar):\n${ejemplos}` : ''}

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

function tryParseArray(text: string): any[] {
  if (!text) return [];
  try { const v = JSON.parse(text); return Array.isArray(v) ? v : []; } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try { const v = JSON.parse(fence[1].trim()); return Array.isArray(v) ? v : []; } catch {}
  }
  const first = text.indexOf('[');
  const last = text.lastIndexOf(']');
  if (first !== -1 && last > first) {
    try { const v = JSON.parse(text.slice(first, last + 1)); return Array.isArray(v) ? v : []; } catch {}
  }
  return [];
}

function validateQuestion(q: any): q is PreguntaGenerada {
  return (
    typeof q?.Pregunta === 'string' && q.Pregunta.length > 0 &&
    typeof q?.Respuesta1 === 'string' && q.Respuesta1.length > 0 &&
    typeof q?.Respuesta2 === 'string' &&
    typeof q?.Respuesta3 === 'string' &&
    typeof q?.Respuesta4 === 'string' &&
    typeof q?.['Mensaje Correcto'] === 'string' &&
    typeof q?.['Mensaje Incorrecto'] === 'string'
  );
}

// ─── Handler principal ────────────────────────────────────────────────────────

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

  const oa = getOA(codigo_oa);
  if (!oa) return res.status(404).json({ error: `OA no encontrado: ${codigo_oa}` });

  const taxonomia = getTaxonomia();
  const recursosValidos = getRecursosValidos(taxonomia, oa.asignatura, dificultad);
  const distribucion = dificultad === 'Auto'
    ? buildDistribucion(taxonomia, oa.asignatura, cantidadFinal)
    : null;

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(oa, dificultad, cantidadFinal, taxonomia, recursosValidos, distribucion);

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });

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
      const retryResponse = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
            { role: 'assistant', content: rawContent },
            { role: 'user', content: 'Tu respuesta anterior no era un JSON array válido con el formato solicitado. Responde ÚNICAMENTE con el JSON array, sin ningún texto adicional ni envoltura.' },
          ],
          temperature: 0.5,
          max_tokens: 4000,
        }),
      });

      if (retryResponse.ok) {
        const retryData = await retryResponse.json();
        const retryContent = retryData?.choices?.[0]?.message?.content ?? '';
        const retryParsed = tryParseArray(retryContent).filter(validateQuestion);
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
