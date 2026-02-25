// RUTA EN TU REPO: src/components/builder/QuestionBank.tsx
// ACCIÓN: REEMPLAZAR el archivo existente

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Check, Loader2, Database, Sparkles } from 'lucide-react';
import AIGeneratorPanel from './AIGeneratorPanel';
import type { AppQuestion } from '@/types/ai';

type Nivel = { id: string; nombre: string };
type Materia = { id: string; nombre: string; nivel_id: string };
type Unidad = { id: string; nombre: string };

type Question = {
  id: string;
  question: string;
  correctAnswer: string;
  incorrectAnswers: string[];
  tags?: string[] | null;
};

type PanelMode = 'banco' | 'ia';

interface QuestionBankProps {
  onAddQuestion: (q: Question) => void;
  onAddQuestionsBulk: (qs: AppQuestion[]) => void;
  selectedQuestionIds: string[];
  currentQuestionCount: number;
}

const QuestionBank: React.FC<QuestionBankProps> = ({
  onAddQuestion,
  onAddQuestionsBulk,
  selectedQuestionIds,
  currentQuestionCount,
}) => {
  const [mode, setMode] = useState<PanelMode>('ia');

  const [niveles, setNiveles] = useState<Nivel[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [selectedNivel, setSelectedNivel] = useState('');
  const [selectedMateria, setSelectedMateria] = useState('');
  const [selectedUnidad, setSelectedUnidad] = useState('');
  const [quizSets, setQuizSets] = useState<Array<{ id: string; title?: string | null }>>([]);
  const [questionsByQuiz, setQuestionsByQuiz] = useState<Record<string, Question[]>>({});
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [loadingSets, setLoadingSets] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'banco') return;
    setLoadingFilters(true);
    Promise.all([
      supabase.from('niveles').select('*'),
      supabase.from('materias').select('*'),
      supabase.from('unidades').select('*'),
    ])
      .then(([n, m, u]) => {
        setNiveles(n.data ?? []);
        setMaterias(m.data ?? []);
        setUnidades(u.data ?? []);
      })
      .catch(console.error)
      .finally(() => setLoadingFilters(false));
  }, [mode]);

  useEffect(() => {
    if (mode !== 'banco') return;
    if (!selectedNivel || !selectedMateria || !selectedUnidad) {
      setQuizSets([]);
      setQuestionsByQuiz({});
      return;
    }
    setLoadingSets(true);
    supabase
      .from('quiz_sets')
      .select('id, title')
      .eq('nivel_id', selectedNivel)
      .eq('materia_id', selectedMateria)
      .eq('unidad_id', selectedUnidad)
      .then(({ data }) => setQuizSets(data ?? []))
      .catch(console.error)
      .finally(() => setLoadingSets(false));
  }, [selectedNivel, selectedMateria, selectedUnidad, mode]);

  const handleFetchQuestions = async (quizId: string) => {
    if (!quizId || questionsByQuiz[quizId]) return;
    setLoadingQuestions(quizId);
    supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quizId)
      .then(({ data }) => {
        const formatted: Question[] = (data ?? []).map((q: any) => ({
          id: q.id,
          question: q.question ?? q.text ?? '',
          correctAnswer: q.correct_answer,
          incorrectAnswers: q.incorrect_answers || [],
          tags: q.tags ?? null,
        }));
        setQuestionsByQuiz((prev) => ({ ...prev, [quizId]: formatted }));
      })
      .catch(console.error)
      .finally(() => setLoadingQuestions(null));
  };

  const filteredMaterias = selectedNivel
    ? materias.filter((m) => m.nivel_id === selectedNivel)
    : [];

  return (
    <Card className="h-full flex flex-col lg:col-span-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Preguntas</CardTitle>

        {/* Switch Banco / Generar con IA */}
        <div className="flex rounded-lg border p-0.5 bg-muted mt-1">
          <button
            onClick={() => setMode('banco')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'banco'
                ? 'bg-white shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            Banco
          </button>
          <button
            onClick={() => setMode('ia')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'ia'
                ? 'bg-white shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generar con IA
          </button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden">

        {/* ── PANEL IA ── */}
        {mode === 'ia' && (
          <AIGeneratorPanel
            onAddQuestionsBulk={onAddQuestionsBulk}
            currentQuestionCount={currentQuestionCount}
          />
        )}

        {/* ── PANEL BANCO ── */}
        {mode === 'banco' && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="space-y-3 p-1">
              {loadingFilters ? (
                <>
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </>
              ) : (
                <>
                  <Select value={selectedNivel} onValueChange={setSelectedNivel}>
                    <SelectTrigger><SelectValue placeholder="Selecciona un Nivel" /></SelectTrigger>
                    <SelectContent>
                      {niveles.map((n) => (
                        <SelectItem key={n.id} value={n.id}>{n.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedMateria} onValueChange={setSelectedMateria} disabled={!selectedNivel}>
                    <SelectTrigger><SelectValue placeholder="Selecciona una Materia" /></SelectTrigger>
                    <SelectContent>
                      {filteredMaterias.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedUnidad} onValueChange={setSelectedUnidad} disabled={!selectedNivel || !selectedMateria}>
                    <SelectTrigger><SelectValue placeholder="Selecciona una Unidad" /></SelectTrigger>
                    <SelectContent>
                      {unidades.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>

            <div className="flex-1 mt-4 overflow-y-auto">
              {loadingSets && (
                <div className="text-center p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
                  Buscando preguntas…
                </div>
              )}

              {!loadingSets && quizSets.length === 0 && selectedNivel && selectedMateria && selectedUnidad && (
                <div className="text-center p-6 text-sm text-muted-foreground">
                  No se encontraron preguntas para esta selección.
                </div>
              )}

              {!loadingSets && !selectedNivel && (
                <div className="text-center p-6 text-sm text-muted-foreground">
                  Selecciona nivel, materia y unidad para ver las preguntas disponibles.
                </div>
              )}

              {quizSets.length > 0 && (
                <Accordion type="single" collapsible className="w-full" onValueChange={handleFetchQuestions}>
                  {quizSets.map((set) => set?.id && (
                    <AccordionItem value={set.id} key={set.id}>
                      <AccordionTrigger className="text-sm font-medium text-left">{set.title}</AccordionTrigger>
                      <AccordionContent>
                        {loadingQuestions === set.id && (
                          <div className="text-center p-2">
                            <Loader2 className="h-4 w-4 animate-spin inline-block" />
                          </div>
                        )}
                        <div className="space-y-2">
                          {questionsByQuiz[set.id]?.map((q) => {
                            const isSelected = selectedQuestionIds.includes(q.id);
                            return (
                              <div
                                key={q.id}
                                className="flex items-start justify-between p-2 rounded-md hover:bg-accent"
                                draggable={false}
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                <div className="flex-1 pr-2 select-text">
                                  <p className="text-sm font-medium">{q.question}</p>
                                  <div className="pl-2 mt-1 text-xs border-l-2 ml-1">
                                    <p className="text-green-700 font-semibold">{q.correctAnswer}</p>
                                    {q.incorrectAnswers.map((ans, idx) => (
                                      <p key={idx} className="text-muted-foreground">{ans}</p>
                                    ))}
                                  </div>
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 flex-shrink-0"
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={() => !isSelected && onAddQuestion(q)}
                                  disabled={isSelected}
                                >
                                  {isSelected
                                    ? <Check className="h-4 w-4 text-green-500" />
                                    : <Plus className="h-4 w-4" />}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QuestionBank;
