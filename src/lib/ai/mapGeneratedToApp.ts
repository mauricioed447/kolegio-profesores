import type { PreguntaGenerada, AppQuestion, AppAlternative } from '@/types/ai';

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function mapGeneratedToApp(items: PreguntaGenerada[]): AppQuestion[] {
  return items.map((q) => {
    const correct: AppAlternative = {
      id: uuid(),
      texto: q.Respuesta1,
      es_correcta: true,
    };

    const incorrects: AppAlternative[] = [q.Respuesta2, q.Respuesta3, q.Respuesta4]
      .filter(Boolean)
      .map((texto) => ({
        id: uuid(),
        texto,
        es_correcta: false,
      }));

    // Mezclar alternativas aleatoriamente
    const alternativas = [correct, ...incorrects].sort(() => Math.random() - 0.5);

    return {
      id: `ai-${uuid()}`,
      texto: q.Pregunta,
      alternativas,
      origen: 'ia' as const,
      nivel_bloom: q.nivel_bloom,
      dificultad: q.dificultad,
    };
  });
}

// Mantener compatibilidad con código legacy que importa desde esta ruta
export { mapGeneratedToApp as mapVertexToApp };
