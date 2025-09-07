import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import jsPDF from 'jspdf';
import { supabase } from './integrations/supabase/client';
import { Nivel, Materia, Unidad, PreguntaApp, QuizQuestionFromDB } from './types';
import QuestionBank from './components/QuestionBank';
import TestBuilder from './components/TestBuilder';
import Configuration from './components/Configuration';
import { Loader2 } from 'lucide-react';

// Transforma una fila de DB al modelo usado en la app
const transformDbQuestionToAppQuestion = (dbQuestion: QuizQuestionFromDB): PreguntaApp => {
  const correctAlt = {
    id: dbQuestion.correct_answer,
    texto: dbQuestion.correct_answer,
    es_correcta: true,
  };

  const incorrectAlts = (dbQuestion.incorrect_answers || []).map((text) => ({
    id: text,
    texto: text,
    es_correcta: false,
  }));

  const alternativas = [correctAlt, ...incorrectAlts].sort(() => Math.random() - 0.5);

  // Fallback de campo del enunciado por si la columna es `question`
  const texto = (dbQuestion as any).text ?? (dbQuestion as any).question ?? '';

  return {
    id: dbQuestion.id,
    texto,
    alternativas,
  } as PreguntaApp;
};

function App() {
  const [niveles, setNiveles] = useState<Nivel[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [preguntas, setPreguntas] = useState<PreguntaApp[]>([]);

  const [selectedNivel, setSelectedNivel] = useState<string | null>(null);
  const [selectedMateria, setSelectedMateria] = useState<string | null>(null);
  const [selectedUnidad, setSelectedUnidad] = useState<string | null>(null);

  const [testQuestions, setTestQuestions] = useState<PreguntaApp[]>([]);
  const [testTitle, setTestTitle] = useState('');
  const [testHeader, setTestHeader] = useState('Nombre: __________________ Curso: _______');
  const [includeAnswerSheet, setIncludeAnswerSheet] = useState(true);

  const [loading, setLoading] = useState({ filters: true, questions: false });

  // Cargar filtros
  useEffect(() => {
    const fetchFilters = async () => {
      setLoading((prev) => ({ ...prev, filters: true }));
      try {
        const { data: nivelesData } = await supabase.from('niveles').select('*');
        const { data: materiasData } = await supabase.from('materias').select('*');
        const { data: unidadesData } = await supabase.from('unidades').select('*');
        setNiveles(nivelesData || []);
        setMaterias(materiasData || []);
        setUnidades(unidadesData || []);
      } catch (error) {
        console.error('Error fetching filters:', error);
      } finally {
        setLoading((prev) => ({ ...prev, filters: false }));
      }
    };
    fetchFilters();
  }, []);

  // Buscar preguntas cuando hay NIVEL + MATERIA + UNIDAD seleccionados
  useEffect(() => {
    if (!selectedNivel || !selectedMateria || !selectedUnidad) {
      setPreguntas([]);
      return;
    }

    const fetchQuestions = async () => {
      setLoading((prev) => ({ ...prev, questions: true }));
      try {
        // 1) IDs de quiz_sets que cumplan los TRES filtros
        const { data: quizSets, error: setsError } = await supabase
          .from('quiz_sets')
          .select('id')
          .eq('nivel_id', selectedNivel)
          .eq('materia_id', selectedMateria)
          .eq('unidad_id', selectedUnidad);

        if (setsError) throw setsError;
        if (!quizSets || quizSets.length === 0) {
          setPreguntas([]);
          return;
        }

        const quizSetIds = quizSets.map((s) => s.id);

        // 2) Traer preguntas por los IDs de quiz (columna correcta: quiz_id)
        const { data: questionsData, error: questionsError } = await supabase
          .from('quiz_questions')
          .select('*')
          .in('quiz_id', quizSetIds);

        if (questionsError) throw questionsError;

        const appQuestions = (questionsData || []).map(transformDbQuestionToAppQuestion);
        setPreguntas(appQuestions);
      } catch (error) {
        console.error('Error fetching questions:', error);
        setPreguntas([]);
      } finally {
        setLoading((prev) => ({ ...prev, questions: false }));
      }
    };

    fetchQuestions();
  }, [selectedNivel, selectedMateria, selectedUnidad]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    if (active.data.current?.from === 'bank' && over.id === 'test-builder-area') {
      const questionToAdd = preguntas.find((p) => p.id === active.id);
      if (questionToAdd && !testQuestions.some((q) => q.id === questionToAdd.id)) {
        setTestQuestions((prev) => [...prev, questionToAdd]);
      }
      return;
    }

    if (active.data.current?.from === 'builder' && over.id !== 'test-builder-area') {
      const oldIndex = testQuestions.findIndex((q) => q.id === active.id);
      const newIndex = testQuestions.findIndex((q) => q.id === over.id);
      if (oldIndex !== newIndex) {
        setTestQuestions((prev) => arrayMove(prev, oldIndex, newIndex));
      }
    }
  };

  const removeQuestion = (id: string) => {
    setTestQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const generatePdf = () => {
    const doc = new jsPDF();
    let y = 20;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;

    const checkPageBreak = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    };

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(testTitle || 'Prueba Sin Título', doc.internal.pageSize.width / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(testHeader, margin, y);
    y += 15;

    testQuestions.forEach((q, index) => {
      const questionText = `${index + 1}. ${q.texto}`;
      const splitQuestion = doc.splitTextToSize(questionText, doc.internal.pageSize.width - margin * 2);

      checkPageBreak(splitQuestion.length * 5 + q.alternativas.length * 5 + 5);

      doc.setFont('helvetica', 'bold');
      doc.text(splitQuestion, margin, y);
      y += splitQuestion.length * 5 + 2;

      doc.setFont('helvetica', 'normal');
      q.alternativas.forEach((alt, altIndex) => {
        const letter = String.fromCharCode(97 + altIndex);
        const altText = `${letter}) ${alt.texto}`;
        const splitAlt = doc.splitTextToSize(altText, doc.internal.pageSize.width - margin * 2 - 5);

        checkPageBreak(splitAlt.length * 5);

        doc.text(splitAlt, margin + 5, y);
        y += splitAlt.length * 5;
      });
      y += 5;
    });

    if (includeAnswerSheet) {
      doc.addPage();
      y = margin;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Hoja de Respuestas', doc.internal.pageSize.width / 2, y, { align: 'center' });
      y += 10;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      testQuestions.forEach((q, index) => {
        const correctAnswerIndex = q.alternativas.findIndex((alt) => alt.es_correcta);
        const correctLetter = correctAnswerIndex !== -1 ? String.fromCharCode(97 + correctAnswerIndex) : 'N/A';
        doc.text(`${index + 1}. ${correctLetter.toUpperCase()}`, margin, y);
        y += 7;
        checkPageBreak(7);
      });
    }

    doc.save(`${testTitle.replace(/ /g, '_') || 'prueba'}.pdf`);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="min-h-screen p-4 md:p-6 lg:p-8 bg-slate-50">
        <header className="flex items-center mb-6">
          <img src="/logo.svg" alt="Kolegio Logo" className="h-10 mr-4" />
          <h1 className="text-3xl font-bold text-gray-800">Kolegio Test Builder</h1>
        </header>

        {loading.filters ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <main className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <QuestionBank
              niveles={niveles}
              materias={materias}
              unidades={unidades}
              preguntas={preguntas}
              selectedNivel={selectedNivel}
              setSelectedNivel={setSelectedNivel}
              selectedMateria={selectedMateria}
              setSelectedMateria={setSelectedMateria}
              selectedUnidad={selectedUnidad}
              setSelectedUnidad={setSelectedUnidad}
              isLoading={loading.questions}
            />
            <TestBuilder questions={testQuestions} onRemove={removeQuestion} />
            <Configuration
              title={testTitle}
              setTitle={setTestTitle}
              header={testHeader}
              setHeader={setTestHeader}
              includeAnswerSheet={includeAnswerSheet}
              setIncludeAnswerSheet={setIncludeAnswerSheet}
              onGeneratePdf={generatePdf}
              isTestEmpty={testQuestions.length === 0}
            />
          </main>
        )}
      </div>
    </DndContext>
  );
}

export default App;
