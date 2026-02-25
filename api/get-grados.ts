import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type OA = {
  asignatura: string;
  grado: string;
  grado_num: number;
  grado_tipo: string;
};

type GradoInfo = {
  grado: string;
  grado_num: number;
  grado_tipo: string;
  asignaturas: string[];
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const filePath = join(__dirname, '_data', 'oas_maestro_final.json');
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as { objetivos: OA[] };

    const gradoMap = new Map<string, GradoInfo>();

    for (const oa of data.objetivos) {
      if (!gradoMap.has(oa.grado)) {
        gradoMap.set(oa.grado, {
          grado: oa.grado,
          grado_num: oa.grado_num,
          grado_tipo: oa.grado_tipo,
          asignaturas: [],
        });
      }

      const entry = gradoMap.get(oa.grado)!;
      if (!entry.asignaturas.includes(oa.asignatura)) {
        entry.asignaturas.push(oa.asignatura);
      }
    }

    const grados = Array.from(gradoMap.values()).sort((a, b) => {
      if (a.grado_tipo !== b.grado_tipo) {
        return a.grado_tipo === 'basico' ? -1 : 1;
      }
      return a.grado_num - b.grado_num;
    });

    res.setHeader('Cache-Control', 's-maxage=3600');
    return res.status(200).json({ grados });

  } catch (e: any) {
    return res.status(500).json({
      error: 'Error cargando datos',
      details: e?.message,
    });
  }
}
