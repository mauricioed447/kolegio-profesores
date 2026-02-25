import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type OA = {
  codigo: string;
  unidad: string;
  descripcion: string;
  asignatura: string;
  grado: string;
  preguntas_ejemplo: any[];
};

type OAResumen = {
  codigo: string;
  unidad: string;
  descripcion_corta: string;
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { grado, asignatura } = req.query;

  if (!grado || !asignatura) {
    return res.status(400).json({
      error: 'Faltan parámetros: grado y asignatura son requeridos',
    });
  }

  try {
    const filePath = join(__dirname, '_data', 'oas_maestro_final.json');
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as { objetivos: OA[] };

    const filtrados = data.objetivos
      .filter(
        (oa) =>
          oa.grado === String(grado) &&
          oa.asignatura === String(asignatura)
      )
      .map((oa): OAResumen => ({
        codigo: oa.codigo,
        unidad: oa.unidad,
        descripcion_corta:
          oa.descripcion.replace(/>/g, '·').slice(0, 120) +
          (oa.descripcion.length > 120 ? '…' : ''),
      }));

    res.setHeader('Cache-Control', 's-maxage=3600');
    return res.status(200).json({ oas: filtrados });

  } catch (e: any) {
    return res.status(500).json({
      error: 'Error cargando datos',
      details: e?.message,
    });
  }
}
