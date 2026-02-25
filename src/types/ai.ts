// RUTA EN TU REPO: src/types/ai.ts
// ACCIÓN: REEMPLAZAR el archivo existente

export type Dificultad = 'Superficial' | 'Medio' | 'Profundo' | 'Auto';

// Lo que enviamos al endpoint generate-questions
export type GenerateQuestionsRequest = {
  codigo_oa: string;
  dificultad: Dificultad;
  cantidad: number;
  es_adicional?: boolean;
};

// Lo que devuelve el endpoint (una pregunta generada)
export type PreguntaGenerada = {
  Pregunta: string;
  Respuesta1: string;
  Respuesta2: string;
  Respuesta3: string;
  Respuesta4: string;
  'Mensaje Correcto': string;
  'Mensaje Incorrecto': string;
  imagen_requerida: false;
  imagen_descripcion: string | null; // reservado para futura implementación premium
  nivel_bloom: string;
  dificultad: string;
};

// Resumen de OA para los dropdowns (nunca el OA completo)
export type OAResumen = {
  codigo: string;
  unidad: string;
  descripcion_corta: string;
};

// Info de grado con sus asignaturas
export type GradoInfo = {
  grado: string;
  grado_num: number;
  grado_tipo: string;
  asignaturas: string[];
};

// Formato interno de la app
export type AppAlternative = {
  id: string;
  texto: string;
  es_correcta: boolean;
};

export type AppQuestion = {
  id: string;
  texto: string;
  alternativas: AppAlternative[];
  origen?: 'ia' | 'banco';
  nivel_bloom?: string;
  dificultad?: string;
};

// Compatibilidad con código legacy
export type GeneratedQuestion = PreguntaGenerada;
export type Difficulty = 'basica' | 'media' | 'avanzada';
