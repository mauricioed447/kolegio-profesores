// RUTA EN TU REPO: api/get-oas.ts
// ACCIÓN: REEMPLAZAR el archivo existente

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

type OAResumen = {
  codigo: string;
  grado: string;
  asignatura: string;
  eje: string;
  descripcion_corta: string;
  basal: boolean;
};

// Extrae el número del OA para ordenamiento numérico correcto
// "CN06 OA 01" -> 1, "FG-MATE-3M-OAC-04" -> 4
function getOANum(codigo: string): number {
  const m = codigo.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

function truncate(text: string, maxWords = 12): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(' ') + '…';
}

let cachedData: any = null;

function getData(): any {
  if (cachedData) return cachedData;
  const filePath = join(__dirname, '_data', 'oas_maestro_v3.json');
  cachedData = JSON.parse(readFileSync(filePath, 'utf-8'));
  return cachedData;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const { grado, asignatura, eje, solo_basal } = req.query;

  if (!grado || !asignatura) {
    return res.status(400).json({ error: 'Faltan parámetros: grado y asignatura son requeridos' });
  }

  try {
    const raw = getData();
    const gradoData = raw.grados?.[String(grado)];
    if (!gradoData) return res.status(200).json({ oas: [] });

    const asigData = gradoData.asignaturas?.[String(asignatura)];
    if (!asigData) return res.status(200).json({ oas: [] });

    const tiene_ejes: boolean    = asigData.tiene_ejes    ?? false;
    const tiene_modulos: boolean = asigData.tiene_modulos ?? false;
    const soloBasal = String(solo_basal) === 'true';

    const results: OAResumen[] = [];

    // Helper para agregar OAs de un contenedor { codigo: oaObj }
    const pushOAs = (objetivos: Record<string, any>, ejeNombre: string) => {
      for (const [codigo, oaObj] of Object.entries(objetivos)) {
        if (soloBasal && !oaObj.basal) continue;
        results.push({
          codigo,
          grado: String(grado),
          asignatura: String(asignatura),
          eje: ejeNombre,
          descripcion_corta: truncate(oaObj.descripcion ?? '', 12),
          basal: oaObj.basal ?? false,
        });
      }
    };

    if (tiene_ejes && asigData.ejes) {
      if (eje) {
        // Filtrar por eje específico
        const ejeData = asigData.ejes[String(eje)];
        if (ejeData?.objetivos) pushOAs(ejeData.objetivos, String(eje));
      } else {
        // Todos los ejes
        for (const [ejeNombre, ejeData] of Object.entries(asigData.ejes as Record<string, any>)) {
          if (ejeData?.objetivos) pushOAs(ejeData.objetivos, ejeNombre);
        }
      }
    } else if (tiene_modulos && asigData.modulos) {
      if (eje) {
        const modData = asigData.modulos[String(eje)];
        if (modData?.objetivos) pushOAs(modData.objetivos, String(eje));
      } else {
        for (const [modNombre, modData] of Object.entries(asigData.modulos as Record<string, any>)) {
          if (modData?.objetivos) pushOAs(modData.objetivos, modNombre);
        }
      }
    } else if (asigData.objetivos) {
      pushOAs(asigData.objetivos, '');
    }

    // Ordenar numéricamente
    results.sort((a, b) => getOANum(a.codigo) - getOANum(b.codigo));

    res.setHeader('Cache-Control', 's-maxage=3600');
    return res.status(200).json({ oas: results });

  } catch (e: any) {
    return res.status(500).json({ error: 'Error al leer datos', details: e?.message });
  }
}
