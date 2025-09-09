export type Difficulty = 'basica' | 'media' | 'avanzada';

export type GenerateQuestionsRequest = {
  topic: string;                 // puede venir vacío si useSeed=true
  count?: number;                // 1-5
  difficulty?: Difficulty;
  useSeed?: boolean;             // usar guía
  seed?: Array<{
    texto: string;
    alternativas: string[];
    correcta: string;
  }>;
  seedLimit?: number;            // cuántas semillas usar (máx 10)
  topicFromSeed?: boolean;       // si true, inferimos el tema desde las semillas
};

export type GeneratedQuestion = {
  texto: string;
  correct_answer: string;
  incorrect_answers: string[];
  tags?: string[];
};

// Tipos usados en el front (constructor)
export type AppAlternative = {
  id: string;
  texto: string;
  es_correcta: boolean;
};

export type AppQuestion = {
  id: string;
  texto: string;
  alternativas: AppAlternative[];
};
