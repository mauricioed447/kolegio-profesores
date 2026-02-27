// RUTA EN TU REPO: src/types/ai.ts
// ACCIÓN: REEMPLAZAR el archivo existente

export type Dificultad = 'Superficial' | 'Medio' | 'Profundo' | 'Auto';

export type GenerateQuestionsRequest = {
  codigo_oa: string;
  dificultad: Dificultad;
  cantidad: number;
  es_adicional?: boolean;
};

export type PreguntaGenerada = {
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

// Resumen de OA para los dropdowns
export type OAResumen = {
  codigo: string;
  grado: string;
  asignatura: string;
  eje: string;
  descripcion_corta: string;
  basal: boolean;
};

// Info de grado con asignaturas y ejes
export type EjeInfo = {
  eje: string;
};

export type AsignaturaInfo = {
  nombre: string;
  tiene_ejes: boolean;
  tiene_modulos: boolean;
  ejes: string[]; // lista de ejes o módulos disponibles
};

export type GradoInfo = {
  grado: string;
  grado_num: number;
  grado_tipo: string;
  asignaturas: AsignaturaInfo[];
};

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

// Compatibilidad legacy
export type GeneratedQuestion = PreguntaGenerada;
export type Difficulty = 'basica' | 'media' | 'avanzada';
