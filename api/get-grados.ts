// RUTA EN TU REPO: api/get-grados.ts
// ACCIÓN: REEMPLAZAR el archivo existente

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Datos embebidos directamente — no requieren lectura de archivos
const GRADOS = [
  {
    "grado": "7° Básico",
    "grado_num": 7,
    "grado_tipo": "basico",
    "asignaturas": [
      "Ciencias Naturales",
      "Historia, Geografía y Ciencias Sociales",
      "Inglés",
      "Lengua y Literatura",
      "Matemática"
    ]
  },
  {
    "grado": "8° Básico",
    "grado_num": 8,
    "grado_tipo": "basico",
    "asignaturas": [
      "Ciencias Naturales",
      "Historia, Geografía y Ciencias Sociales",
      "Inglés",
      "Lengua y Literatura",
      "Matemática"
    ]
  },
  {
    "grado": "1° Medio",
    "grado_num": 9,
    "grado_tipo": "medio",
    "asignaturas": [
      "Biología",
      "Física",
      "Historia, Geografía y Ciencias Sociales",
      "Inglés",
      "Lengua y Literatura",
      "Matemática",
      "Química"
    ]
  },
  {
    "grado": "2° Medio",
    "grado_num": 10,
    "grado_tipo": "medio",
    "asignaturas": [
      "Biología",
      "Física",
      "Historia, Geografía y Ciencias Sociales",
      "Inglés",
      "Lengua y Literatura",
      "Matemática",
      "Química"
    ]
  },
  {
    "grado": "3° Medio",
    "grado_num": 11,
    "grado_tipo": "medio",
    "asignaturas": [
      "Ciencia para la Ciudadanía",
      "Educación Ciudadana",
      "Filosofía",
      "Inglés",
      "Lengua y Literatura",
      "Matemática"
    ]
  },
  {
    "grado": "4° Medio",
    "grado_num": 12,
    "grado_tipo": "medio",
    "asignaturas": [
      "Educación Ciudadana",
      "Filosofía",
      "Inglés",
      "Lengua y Literatura",
      "Matemática"
    ]
  }
];

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  res.setHeader('Cache-Control', 's-maxage=3600');
  return res.status(200).json({ grados: GRADOS });
}
