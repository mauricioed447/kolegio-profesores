// RUTA: src/components/builder/QuestionBank.tsx

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { Nivel, Materia, Unidad, QuizSet, Question, SelectedQuestion } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from '@/components/ui/button';
import { Plus, Check, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface QuestionBankProps {
  onAddQuestion: (question: SelectedQuestion) => void;
  selectedQuestionIds: string[];
}

const QuestionBank: React.FC<QuestionBankProps> = ({ onAddQuestion, selectedQuestionIds }) => {
  const [niveles, setNiveles] = useState<Nivel[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);

  const [selectedNivel, setSelectedNivel] = useState<string>('');
  const [selectedMateria, setSelectedMateria] = useState<string>('');
  const [selectedUnidad, setSelectedUnidad] = useState<string>('');

  const [quizSets, setQuizSets] = useState<Partial<QuizSet>[]>([]);
  const [questionsByQuiz, setQuestionsByQuiz] = useState<Record<string, Question[]>>({});

  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingSets, setLoadingSets] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState<string | null>(null);

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        setLoadingFilters(true);
        const { data: nivelesData, error: nivelesError } = await supabase.from('niveles').select('*');
        if (nivelesError) throw nivelesError;
        setNiveles(nivelesData);

        const { data: materiasData, error: materiasError } = await supabase.from('materias').select('*');
        if (materiasError) throw materiasError;
        setMaterias(materiasData);

        const { data: unidadesData, error: unidadesError } = await supabase.from('unidades').select('*');
        if (unidadesError) throw unidadesError;
        setUnidades(unidadesData);
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
        setQuestionsByQuiz({}); // Limpiar preguntas anteriores al cambiar de filtro
        try {
          const { data, error } = await supabase.from('quiz_sets')
            .select('id, title')
            .eq('nivel_id', selectedNivel)
            .eq('materia_id', selectedMateria)
            .eq('unidad_id', selectedUnidad);
          
          if (error) throw error;
          setQuizSets(data);
        } catch (error) {
          console.error("Error fetching quiz sets:", error);
        } finally {
          setLoadingSets(false);
        }
      };
      fetchQuizSets();
    }
  }, [selectedNivel, selectedMateria, selectedUnidad]);

  const handleFetchQuestions = async (quizId: string) => {
    if (!quizId || questionsByQuiz[quizId]) return;
    setLoadingQuestions(quizId);
    try {
      // --- INICIO DE LA CORRECCIÓN 1: 'quiz_set_id' en lugar de 'quiz_id' ---
      const { data, error } = await supabase.from('quiz_questions').select('*').eq('quiz_set_id', quizId);
      if (error) throw error;
      
      const formattedQuestions = data.map(q => ({
        id: q.id,
        question: q.text, // La columna se llama 'text' en tu DB, no 'question'
        correctAnswer: q.correct_answer,
        incorrectAnswers: q.incorrect_answers || [], // Aseguramos que sea un array
        tags: q.tags,
      }));

      setQuestionsByQuiz(prev => ({ ...prev, [quizId]: formattedQuestions }));
    } catch (error) {
      console.error(`Error fetching questions for quiz ${quizId}:`, error);
    } finally {
      setLoadingQuestions(null);
    }
  };
  
  const filteredMaterias = materias.filter(m => m.nivel_id === selectedNivel);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Banco de Preguntas</CardTitle>
        <CardDescription>Filtra y selecciona preguntas de los quizzes existentes.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <div className="space-y-3 p-1">
          {loadingFilters ? (
            <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : (
            <>
              <Select value={selectedNivel} onValueChange={setSelectedNivel}><SelectTrigger><SelectValue placeholder="Selecciona un Nivel" /></SelectTrigger><SelectContent>{niveles.map(n => <SelectItem key={n.id} value={n.id}>{n.nombre}</SelectItem>)}</SelectContent></Select>
              <Select value={selectedMateria} onValueChange={setSelectedMateria} disabled={!selectedNivel}><SelectTrigger><SelectValue placeholder="Selecciona una Materia" /></SelectTrigger><SelectContent>{filteredMaterias.map(m => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}</SelectContent></Select>
              <Select value={selectedUnidad} onValueChange={setSelectedUnidad} disabled={!selectedNivel || !selectedMateria}><SelectTrigger><SelectValue placeholder="Selecciona una Unidad" /></SelectTrigger><SelectContent>{unidades.map(u => <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>)}</SelectContent></Select>
            </>
          )}
        </div>

        <div className="flex-1 mt-4 overflow-y-auto">
          {loadingSets && <div className="text-center p-4 text-sm text-muted-foreground">Buscando quizzes...</div>}
          {!loadingSets && quizSets.length === 0 && selectedNivel && selectedMateria && selectedUnidad && (
            <div className="text-center p-4 text-sm text-muted-foreground">No se encontraron quizzes para esta selección.</div>
          )}
          {quizSets.length > 0 && (
            <Accordion type="single" collapsible className="w-full" onValueChange={handleFetchQuestions}>
              {quizSets.map(set => set && set.id && (
                <AccordionItem value={set.id} key={set.id}>
                  <AccordionTrigger className="text-sm font-medium">{set.title}</AccordionTrigger>
                  <AccordionContent>
                    {loadingQuestions === set.id && <div className="text-center p-2"><Loader2 className="h-4 w-4 animate-spin inline-block" /></div>}
                    
                    {/* --- INICIO DE LA CORRECCIÓN 2: Mostrar alternativas --- */}
                    {questionsByQuiz[set.id]?.map((q) => {
                      const isSelected = selectedQuestionIds.includes(q.id);
                      return (
                        <div key={q.id} className="flex items-start justify-between p-2 hover:bg-accent rounded-md">
                          <div className="flex-1 pr-2">
                            <p className="text-sm">{q.question}</p>
                            <div className="pl-2 mt-1 text-xs border-l-2">
                                <p className="text-green-600 font-semibold">{q.correctAnswer}</p>
                                {q.incorrectAnswers.map((ans, idx) => (
                                    <p key={idx} className="text-muted-foreground">{ans}</p>
                                ))}
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 flex-shrink-0 mt-1"
                            onClick={() => onAddQuestion({ ...q, dndId: crypto.randomUUID() })}
                            disabled={isSelected}
                            aria-label={isSelected ? 'Pregunta añadida' : 'Añadir pregunta'}
                          >
                            {isSelected ? <Check className="h-4 w-4 text-green-500" /> : <Plus className="h-4 w-4" />}
                          </Button>
                        </div>
                      );
                    })}
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
