import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from '@/components/ui/button';
import { Plus, Check, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

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

interface QuestionBankProps {
  onAddQuestion: (q: Question) => void;
  selectedQuestionIds: string[];
}

const QuestionBank: React.FC<QuestionBankProps> = ({ onAddQuestion, selectedQuestionIds }) => {
  const [niveles, setNiveles] = useState<Nivel[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);

  const [selectedNivel, setSelectedNivel] = useState<string>('');
  const [selectedMateria, setSelectedMateria] = useState<string>('');
  const [selectedUnidad, setSelectedUnidad] = useState<string>('');

  const [quizSets, setQuizSets] = useState<Array<{ id: string; title?: string | null }>>([]);
  const [questionsByQuiz, setQuestionsByQuiz] = useState<Record<string, Question[]>>({});

  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingSets, setLoadingSets] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState<string | null>(null);

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        setLoadingFilters(true);
        const { data: nivelesData } = await supabase.from('niveles').select('*');
        setNiveles(nivelesData || []);
        const { data: materiasData } = await supabase.from('materias').select('*');
        setMaterias(materiasData || []);
        const { data: unidadesData } = await supabase.from('unidades').select('*');
        setUnidades(unidadesData || []);
      } catch (error) {
        console.error("Error fetching filters:", error);
      } finally {
        setLoadingFilters(false);
      }
    };
    fetchFilters();
  }, []);

  useEffect(() => {
    if (selectedNivel && selectedMateria && selectedUnidad) {
      const fetchQuizSets = async () => {
        setLoadingSets(true);
        setQuizSets([]);
        setQuestionsByQuiz({});
        try {
          const { data, error } = await supabase
            .from('quiz_sets')
            .select('id, title')
            .eq('nivel_id', selectedNivel)
            .eq('materia_id', selectedMateria)
            .eq('unidad_id', selectedUnidad);

          if (error) throw error;
          setQuizSets(data || []);
        } catch (error) {
          console.error("Error fetching quiz sets:", error);
        } finally {
          setLoadingSets(false);
        }
      };
      fetchQuizSets();
    } else {
      setQuizSets([]);
      setQuestionsByQuiz({});
    }
  }, [selectedNivel, selectedMateria, selectedUnidad]);

  const handleFetchQuestions = async (quizId: string) => {
    if (!quizId || questionsByQuiz[quizId]) return;
    setLoadingQuestions(quizId);
    try {
      // ✅ usar quiz_id y fallback text/question
      const { data, error } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizId);

      if (error) throw error;

      const formatted: Question[] = (data || []).map((q: any) => ({
        id: q.id,
        question: q.question ?? q.text ?? '',
        correctAnswer: q.correct_answer,
        incorrectAnswers: q.incorrect_answers || [],
        tags: q.tags ?? null,
      }));

      setQuestionsByQuiz((prev) => ({ ...prev, [quizId]: formatted }));
    } catch (error) {
      console.error(`Error fetching questions for quiz ${quizId}:`, error);
    } finally {
      setLoadingQuestions(null);
    }
  };

  const filteredMaterias = selectedNivel
    ? materias.filter((m) => m.nivel_id === selectedNivel)
    : [];

  return (
    <Card className="h-full flex flex-col lg:col-span-4">
      <CardHeader>
        <CardTitle>Banco de Preguntas</CardTitle>
        <CardDescription>Selecciona con el botón “+”. Arrastrar está deshabilitado.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <div className="space-y-3 p-1">
          {loadingFilters ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
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

              <Select
                value={selectedUnidad}
                onValueChange={setSelectedUnidad}
                disabled={!selectedNivel || !selectedMateria}
              >
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
            <div className="text-center p-4 text-sm text-muted-foreground">Buscando quizzes...</div>
          )}

          {!loadingSets && quizSets.length === 0 && selectedNivel && selectedMateria && selectedUnidad && (
            <div className="text-center p-4 text-sm text-muted-foreground">
              No se encontraron quizzes para esta selección.
            </div>
          )}

          {quizSets.length > 0 && (
            // onValueChange dispara la carga de preguntas sin arrastre
            <Accordion type="single" collapsible className="w-full" onValueChange={handleFetchQuestions}>
              {quizSets.map((set) => set && set.id && (
                <AccordionItem value={set.id!} key={set.id}>
                  <AccordionTrigger className="text-sm font-medium text-left">{set.title}</AccordionTrigger>
                  <AccordionContent>
                    {loadingQuestions === set.id && (
                      <div className="text-center p-2">
                        <Loader2 className="h-4 w-4 animate-spin inline-block" />
                      </div>
                    )}

                    <div className="space-y-2">
                      {questionsByQuiz[set.id!]?.map((q) => {
                        const isSelected = selectedQuestionIds.includes(q.id);
                        return (
                          <div
                            key={q.id}
                            className="flex items-start justify-between p-2 rounded-md hover:bg-accent cursor-default" // 👈 sin “grab”
                            draggable={false}
                            onPointerDown={(e) => e.stopPropagation()} // 👈 evita que DnD intercepte
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
                              className="h-7 w-7 flex-shrink-0 cursor-pointer"
                              title={isSelected ? "Ya agregada" : "Agregar a la prueba"}
                              onPointerDown={(e) => e.stopPropagation()} // 👈 asegura click limpio
                              onClick={() => !isSelected && onAddQuestion(q)}
                              disabled={isSelected}
                              aria-disabled={isSelected}
                            >
                              {isSelected ? <Check className="h-4 w-4 text-green-500" /> : <Plus className="h-4 w-4" />}
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
      </CardContent>
    </Card>
  );
};

export default QuestionBank;
