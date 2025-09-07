import React, { useState } from 'react';
import jsPDF from 'jspdf';
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

import TestBuilder from './components/TestBuilder';
import Configuration from './components/Configuration';

// 👇 usamos el QuestionBank “builder”
import QuestionBank from './components/builder/QuestionBank';

// Tipado mínimo para el constructor (ajústalo si ya lo tienes en ./types)
export interface Alternativa {
  id: string;
  texto: string;
  es_correcta: boolean;
}

export interface PreguntaApp {
  id: string;
  texto: string;
  alternativas: Alternativa[];
}

function App() {
  const [testQuestions, setTestQuestions] = useState<PreguntaApp[]>([]);
  const [testTitle, setTestTitle] = useState('');
  const [testHeader, setTestHeader] = useState('Nombre: __________________ Curso: _______');
  const [includeAnswerSheet, setIncludeAnswerSheet] = useState(true);

  // DnD SOLO para reordenar dentro del constructor
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 👉 Agregar desde el botón +
  const handleAddFromBank = (q: any) => {
    // q viene del banco con forma { id, question?, text?, correctAnswer, incorrectAnswers[] }
    const texto = q.question ?? q.text ?? '';
    if (!texto) return;

    if (testQuestions.some((t) => t.id === q.id)) return;

    const alternativas: Alternativa[] = [
      { id: q.correctAnswer, texto: q.correctAnswer, es_correcta: true },
      ...(q.incorrectAnswers || []).map((t: string) => ({ id: t, texto: t, es_correcta: false })),
    ].sort(() => Math.random() - 0.5);

    setTestQuestions((prev) => [...prev, { id: q.id, texto, alternativas }]);
  };

  // 🚫 Eliminado el “drop desde banco”
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    // Reordenar SOLO dentro del constructor
    if (active.data.current?.from === 'builder' && over.id !== 'test-builder-area') {
      const oldIndex = testQuestions.findIndex((q) => q.id === active.id);
      const newIndex = testQuestions.findIndex((q) => q.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
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

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Banco de preguntas con botón + */}
          <QuestionBank
            onAddQuestion={handleAddFromBank}
            selectedQuestionIds={testQuestions.map((q) => q.id)}
          />

          {/* Constructor (reordenar dentro con DnD) */}
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
      </div>
    </DndContext>
  );
}

export default App;
