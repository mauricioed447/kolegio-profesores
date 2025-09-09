import type { GeneratedQuestion, AppQuestion, AppAlternative } from '@/types/ai';

const uuid = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function mapGeneratedToApp(items: GeneratedQuestion[]): AppQuestion[] {
  return items.map((q) => {
    const correct: AppAlternative = {
      id: uuid(),
      texto: q.correct_answer,
      es_correcta: true
    };
    const incorrects: AppAlternative[] = (q.incorrect_answers || []).map((t) => ({
      id: uuid(),
      texto: t,
      es_correcta: false
    }));
    const alternativas = [correct, ...incorrects].sort(() => Math.random() - 0.5);

    return {
      id: `ai-${uuid()}`,
      texto: q.texto,
      alternativas
    };
  });
}
