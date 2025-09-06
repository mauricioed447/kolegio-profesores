// RUTA: src/types/index.ts

export interface Question {
  id: string;
  question: string;
  correctAnswer: string;
  incorrectAnswers: string[];
  tags: string[] | null;
}

export interface QuizSet {
  id: string;
  title: string;
  created_at: string;
  nivel_id: string | null;
  materia_id: string | null;
  unidad_id: string | null;
  questions: Question[]; // Las preguntas se cargarán por separado
}

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
}

// Un tipo especial para las preguntas seleccionadas que incluye
// un ID único para la funcionalidad de arrastrar y soltar (drag-and-drop).
export type SelectedQuestion = Question & {
  dndId: string;
};
