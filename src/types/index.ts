// RUTA: src/types/index.ts

export interface Question {
  id: string;
  question: string; // <-- La app usará 'question' internamente
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
  questions: Question[];
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

export type SelectedQuestion = Question & {
  dndId: string;
};
