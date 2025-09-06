// Este es un tipo genérico para la base de datos autogenerada por Supabase.
// Si no tienes los tipos, puedes usar 'any' temporalmente,
// pero es muy recomendable generarlos para tener autocompletado y seguridad.
export type Database = any;

// Tipos específicos para nuestra aplicación
export interface Nivel {
  id: string;
  nombre: string;
}

export interface Materia {
  id: string;
  nombre: string;
  nivel_id: string;
}

export interface Unidad {
  id: string;
  nombre: string;
  materia_id: string;
}

export interface Alternativa {
  id: string;
  texto: string;
  es_correcta: boolean;
  pregunta_id: string;
}

export interface Pregunta {
  id: string;
  texto: string;
  unidad_id: string;
  alternativas: Alternativa[];
}
