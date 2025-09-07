import { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import jsPDF from 'jspdf';
import { supabase } from './integrations/supabase/client';
import { Nivel, Materia, Unidad, PreguntaApp, QuizQuestionFromDB, AlternativaApp } from './types';
import QuestionBank from './components/QuestionBank';
import TestBuilder from './components/TestBuilder';
import Configuration from './components/Configuration';
import { Loader2 } from 'lucide-react';

// Función para transformar los datos de la DB al formato que la App necesita
const transformDbQuestionToAppQuestion = (dbQuestion: QuizQuestionFromDB): PreguntaApp => {
  const correctAlt: AlternativaApp = {
    id: dbQuestion.correct_answer,
    texto: dbQuestion.correct_answer,
    es_correcta: true,
  };
  
  const incorrectAlts: AlternativaApp[] = (dbQuestion.incorrect_answers || []).map(text => ({
    id: text,
    texto: text,
    es_correcta: false,
  }));
  
  const allAlts = [correctAlt, ...incorrectAlts];
  const shuffledAlts = allAlts.sort(() => Math.random() - 0.5);

  return {
    id: dbQuestion.id,
    texto: dbQuestion.text,
    alternativas: shuffledAlts,
  };
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

  useEffect(() => {
    const fetchFilters = async () => {
      setLoading(prev => ({ ...prev, filters: true }));
      try {
        const { data: nivelesData } = await supabase.from('niveles').select('*');
        const { data: materiasData } = await supabase.from('materias').select('*');
        const { data: unidadesData } = await supabase.from('unidades').select('*');
        setNiveles(nivelesData || []);
        setMaterias(materiasData || []);
        setUnidades(unidadesData || []);
      } catch (error) {
        console.error("Error fetching filters:", error);
      } finally {
        setLoading(prev => ({ ...prev, filters: false }));
      }
    };
    fetchFilters();
  }, []);

  // --- LÓGICA DE BÚSQUEDA DE PREGUNTAS (ROBUSTA Y CORREGIDA) ---
  useEffect(() => {
    if (!selectedNivel || !selectedMateria || !selectedUnidad) {
      setPreguntas([]);
      return;
    }
    
    const fetchQuestions = async () => {
      setLoading(prev => ({ ...prev, questions: true }));
      try {
        // 1. Encontrar los quiz_sets que coincidan con los tres filtros.
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

        const quizSetIds = quizSets.map(set => set.id);

        // 2. Crear un array de promesas, una por cada quiz_set_id.
        // Esto evita el error de URL demasiado larga de la consulta .in().
        const questionPromises = quizSetIds.map(id =>
          supabase.from('quiz_questions').select('*').eq('quiz_set_id', id)
        );

        // 3. Ejecutar todas las peticiones en paralelo.
        const questionResults = await Promise.all(questionPromises);

        // 4. Procesar y unificar los resultados de todas las peticiones.
        const allQuestionsData: QuizQuestionFromDB[] = [];
        for (const result of questionResults) {
          if (result.error) {
            // Si una de las muchas peticiones falla, lo notificamos pero continuamos.
            console.error("Error fetching questions for a specific quiz set:", result.error);
            continue; 
          }
          if (result.data) {
            allQuestionsData.push(...result.data);
          }
        }
        
        // 5. Transformar y actualizar el estado final.
        const appQuestions = allQuestionsData.map(transformDbQuestionToAppQuestion);
        setPreguntas(appQuestions);
        
      } catch (error) {
        // Captura errores generales (ej: fallo en la búsqueda de quiz_sets)
        console.error("A general error occurred while fetching questions:", error);
        setPreguntas([]); // Asegurarse de limpiar las preguntas si hay un error
      } finally {
        setLoading(prev => ({ ...prev, questions: false }));
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
      const questionToAdd = preguntas.find(p => p.id === active.id);
      if (questionToAdd && !testQuestions.some(q => q.id === questionToAdd.id)) {
        setTestQuestions(prev => [...prev, questionToAdd]);
      }
      return;
    }

    if (active.data.current?.from === 'builder' && over.id !== active.id) {
        const oldIndex = testQuestions.findIndex(q => q.id === active.id);
        const newIndex = over.id === 'test-builder-area' 
            ? testQuestions.length -1 
            : testQuestions.findIndex(q => q.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
            setTestQuestions(prev => arrayMove(prev, oldIndex, newIndex));
        }
    }
  };
  
  const removeQuestion = (id: string) => {
    setTestQuestions(prev => prev.filter(q => q.id !== id));
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
            const correctAnswerIndex = q.alternativas.findIndex(alt => alt.es_correcta);
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
