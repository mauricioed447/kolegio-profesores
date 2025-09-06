// Este es un tipo genérico para la base de datos autogenerada por Supabase.
export type Database = any;

// --- Tipos que coinciden con tu Base de Datos ---

export interface Nivel {
  id: string;
  nombre: string;
}

export interface Materia {
  id: string;
  nombre: string;
  nivel_id: string;
}

// La tabla 'unidades' es independiente
export interface Unidad {
  id: string;
  nombre: string;
}

// Representa una fila de tu tabla 'quiz_questions'
export interface QuizQuestionFromDB {
  id: string;
  text: string;
  correct_answer: string;
  incorrect_answers: string[] | null;
  quiz_set_id: string;
}

// --- Tipos que usará la Aplicación internamente ---

// La app necesita un formato unificado para las alternativas
export interface AlternativaApp {
  id: string; // Usaremos el texto como ID para simplicidad
  texto: string;
  es_correcta: boolean;
}

// Este es el objeto 'Pregunta' que usará toda la aplicación después de la transformación
export interface PreguntaApp {
  id: string;
  texto: string;
  alternativas: AlternativaApp[];
}
