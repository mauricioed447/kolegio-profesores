import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AppQuestion, GeneratedQuestion, GenerateQuestionsRequest } from '@/types/ai';
import { mapGeneratedToApp } from '@/lib/ai/mapVertexToApp';

type SeedQuestion = {
  texto: string;
  alternativas: string[];
  correcta: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onAddQuestionsBulk: (qs: AppQuestion[]) => void;
  seedQuestions: Array<{
    texto: string;
    alternativas: Array<{ texto: string; es_correcta: boolean }>;
  }>;
};

const GenerateQuestionsModal: React.FC<Props> = ({
  open,
  onClose,
  onAddQuestionsBulk,
  seedQuestions
}) => {
  const [topic, setTopic] = useState<string>('riñón');
  const [count, setCount] = useState<number>(3);
  const [difficulty, setDifficulty] = useState<'basica' | 'media' | 'avanzada'>('basica');
  const [useSeed, setUseSeed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const seedPayload: SeedQuestion[] = useMemo(() => {
    if (!useSeed) return [];
    return seedQuestions.slice(0, 5).map((q) => {
      const correcta = q.alternativas.find((a) => a.es_correcta)?.texto || '';
      const alternativas = q.alternativas.map((a) => a.texto);
      return { texto: q.texto, alternativas, correcta };
    });
  }, [useSeed, seedQuestions]);

  if (!open) return null;

  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

  const handleSubmit = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const payload: GenerateQuestionsRequest = {
        topic: topic.trim(),
        count: clamp(Number(count || 3), 1, 5),
        difficulty,
        useSeed,
        seed: seedPayload
      };

      const r = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!r.ok) {
        const text = await r.text().catch(() => '');
        throw new Error(text || `HTTP ${r.status}`);
      }

      const data = (await r.json()) as GeneratedQuestion[];
      const appQs = mapGeneratedToApp(data);
      onAddQuestionsBulk(appQs);
      onClose();
    } catch (e: any) {
      setErrorMsg(e?.message || 'Error al generar preguntas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-xl shadow-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Generar preguntas (IA)</h2>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:underline">Cerrar</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Tema / Especificación</label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ej.: riñón" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Cantidad (1–5)</label>
              <Input
                type="number"
                min={1}
                max={5}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Dificultad</label>
              <select
                className="w-full border rounded-md p-2 text-sm bg-background"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
              >
                <option value="basica">Básica</option>
                <option value="media">Media</option>
                <option value="avanzada">Avanzada</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="use-seed"
              type="checkbox"
              checked={useSeed}
              onChange={(e) => setUseSeed(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="use-seed" className="text-sm">
              Usar como guía las preguntas seleccionadas en el constructor
            </label>
          </div>

          {errorMsg && (
            <div className="text-sm text-red-600">{errorMsg}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={loading || !topic.trim()}>
              {loading ? 'Generando…' : 'Generar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenerateQuestionsModal;
