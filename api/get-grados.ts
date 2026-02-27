// RUTA EN TU REPO: api/get-grados.ts
// ACCIÓN: REEMPLAZAR el archivo existente

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

type GradoInfo = {
  grado: string;
  grado_num: number;
  grado_tipo: string;
  asignaturas: AsignaturaInfo[];
};

type AsignaturaInfo = {
  nombre: string;
  tiene_ejes: boolean;
  tiene_modulos: boolean;
  ejes: string[];
};

const GRADO_ORDER = [
  '6° Básico',
  '7° Básico',
  '8° Básico',
  '1° Medio',
  '2° Medio',
  '3° Medio',
  '4° Medio',
];

const GRADO_META: Record<string, { num: number; tipo: string }> = {
  '6° Básico': { num: 6,  tipo: 'basico' },
  '7° Básico': { num: 7,  tipo: 'basico' },
  '8° Básico': { num: 8,  tipo: 'basico' },
  '1° Medio':  { num: 9,  tipo: 'medio'  },
  '2° Medio':  { num: 10, tipo: 'medio'  },
  '3° Medio':  { num: 11, tipo: 'medio'  },
  '4° Medio':  { num: 12, tipo: 'medio'  },
};

let cachedGrados: GradoInfo[] | null = null;

function buildGrados(): GradoInfo[] {
  if (cachedGrados) return cachedGrados;

  const filePath = join(__dirname, '_data', 'oas_maestro_v3.json');
  const raw = JSON.parse(readFileSync(filePath, 'utf-8'));

  const grados: GradoInfo[] = [];

  for (const gradoNombre of GRADO_ORDER) {
    const gradoData = raw.grados?.[gradoNombre];
    if (!gradoData) continue;

    const meta = GRADO_META[gradoNombre] ?? { num: 0, tipo: 'basico' };
    const asignaturas: AsignaturaInfo[] = [];

    for (const [asigNombre, asigData] of Object.entries(gradoData.asignaturas as Record<string, any>)) {
      const tiene_ejes: boolean    = asigData.tiene_ejes    ?? false;
      const tiene_modulos: boolean = asigData.tiene_modulos ?? false;
      let ejes: string[] = [];

      if (tiene_ejes && asigData.ejes) {
        ejes = Object.keys(asigData.ejes);
      } else if (tiene_modulos && asigData.modulos) {
        ejes = Object.keys(asigData.modulos);
      }

      asignaturas.push({ nombre: asigNombre, tiene_ejes, tiene_modulos, ejes });
    }

    grados.push({
      grado: gradoNombre,
      grado_num: meta.num,
      grado_tipo: meta.tipo,
      asignaturas,
    });
  }

  cachedGrados = grados;
  return grados;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const grados = buildGrados();
    res.setHeader('Cache-Control', 's-maxage=3600');
    return res.status(200).json({ grados });
  } catch (e: any) {
    return res.status(500).json({ error: 'Error al leer datos', details: e?.message });
  }
}
