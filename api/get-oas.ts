import type { VercelRequest, VercelResponse } from '@vercel/node';
import { join } from 'path';

type OA = {
  codigo: string;
  unidad: string;
  descripcion: string;
  indicadores: string[];
  palabras_clave: string[];
  proposito_unidad: string;
  asignatura: string;
  grado: string;
  grado_num: number;
  grado_tipo: string;
  modulo: string;
  preguntas_ejemplo: any[];
};

// Solo devolvemos lo necesario para el dropdown, nunca el OA completo
type OAResumen = {
  codigo: string;
  unidad: string;
  descripcion_corta: string; // primeras 80 chars para el dropdown
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const { grado, asignatura } = req.query;

  if (!grado || !asignatura) {
    return res.status(400).json({ error: 'Faltan parámetros: grado y asignatura son requeridos' });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const data = require('./_data/oas_maestro_final.json') as { objetivos: OA[] };

    const filtrados = data.objetivos
      .filter(
        (oa) =>
          oa.grado === String(grado) &&
          oa.asignatura === String(asignatura)
      )
      .map((oa): OAResumen => ({
        codigo: oa.codigo,
        unidad: oa.unidad,
        descripcion_corta: oa.descripcion.replace(/>/g, '·').slice(0, 120) + (oa.descripcion.length > 120 ? '…' : ''),
      }));

    res.setHeader('Cache-Control', 's-maxage=3600');
    return res.status(200).json({ oas: filtrados });
  } catch (e: any) {
    return res.status(500).json({ error: 'Error cargando datos', details: e?.message });
  }
}
