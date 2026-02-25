import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createReadStream } from 'fs';
import { join } from 'path';

// Leemos el JSON en el servidor, nunca sale el archivo completo al cliente
const DATA_PATH = join(__dirname, '_data', 'oas_maestro_final.json');

type OA = {
  codigo: string;
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
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const data = require('./_data/oas_maestro_final.json') as { objetivos: OA[] };
    const oas: OA[] = data.objetivos;

    // Construir mapa grado → asignaturas únicas
    const gradoMap = new Map<string, GradoInfo>();

    for (const oa of oas) {
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

    // Ordenar grados: básico primero (7°, 8°), luego medio (1°→4°)
    const grados = Array.from(gradoMap.values()).sort((a, b) => {
      if (a.grado_tipo !== b.grado_tipo) {
        return a.grado_tipo === 'basico' ? -1 : 1;
      }
      return a.grado_num - b.grado_num;
    });

    res.setHeader('Cache-Control', 's-maxage=3600');
    return res.status(200).json({ grados });
  } catch (e: any) {
    return res.status(500).json({ error: 'Error cargando datos', details: e?.message });
  }
}
