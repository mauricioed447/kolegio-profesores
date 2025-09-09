export type Difficulty = 'basica' | 'media' | 'avanzada';

export type GenerateQuestionsRequest = {
  topic: string;
  count?: number;
  difficulty?: Difficulty;
  useSeed?: boolean;
  seed?: Array<{
    texto: string;
    alternativas: string[];
    correcta: string;
  }>;
};

export type GeneratedQuestion = {
  texto: string;
  correct_answer: string;
  incorrect_answers: string[];
  tags?: string[];
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
};
