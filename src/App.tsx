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
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

import TestBuilder from './components/TestBuilder';
import Configuration from './components/Configuration';
import QuestionBank from './components/builder/QuestionBank';

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

  // Util para crear IDs de alternativas estables (no dependen del texto)
  const uuid = () =>
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  // Agregar desde el banco (botón +)
  const handleAddFromBank = (q: any) => {
    const texto = q.question ?? q.text ?? '';
    if (!texto) return;
    if (testQuestions.some((t) => t.id === q.id)) return;

    const alternativas: Alternativa[] = [
      { id: uuid(), texto: q.correctAnswer, es_correcta: true },
      ...(q.incorrectAnswers || []).map((t: string) => ({ id: uuid(), texto: t, es_correcta: false })),
    ].sort(() => Math.random() - 0.5);

    setTestQuestions((prev) => [...prev, { id: q.id, texto, alternativas }]);
  };

  // Reordenar preguntas dentro del constructor
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    const oldIndex = testQuestions.findIndex((q) => q.id === active.id);
    const newIndex = testQuestions.findIndex((q) => q.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      setTestQuestions((prev) => arrayMove(prev, oldIndex, newIndex));
    }
  };

  const removeQuestion = (id: string) => {
    setTestQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  // ---- Callbacks de edición en FRONT ----
  const updateQuestionText = (qId: string, newText: string) => {
    setTestQuestions((prev) =>
      prev.map((q) => (q.id === qId ? { ...q, texto: newText } : q))
    );
  };

  const updateAlternativeText = (qId: string, altId: string, newText: string) => {
    setTestQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? {
              ...q,
              alternativas: q.alternativas.map((a) =>
                a.id === altId ? { ...a, texto: newText } : a
              ),
            }
          : q
      )
    );
  };

  const setCorrectAlternative = (qId: string, altId: string) => {
    setTestQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? {
              ...q,
              alternativas: q.alternativas.map((a) => ({
                ...a,
                es_correcta: a.id === altId,
              })),
            }
          : q
      )
    );
  };

  const addAlternative = (qId: string) => {
    setTestQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? {
              ...q,
              alternativas: [
                ...q.alternativas,
                { id: uuid(), texto: 'Nueva alternativa', es_correcta: false },
              ],
            }
          : q
      )
    );
  };

  const removeAlternative = (qId: string, altId: string) => {
    setTestQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const remaining = q.alternativas.filter((a) => a.id !== altId);
        // Mantener al menos 2 alternativas
        if (remaining.length < 2) return q;

        // Si quitamos la correcta, marcamos la primera como correcta
        const removedWasCorrect = q.alternativas.find((a) => a.id === altId)?.es_correcta;
        const normalized = removedWasCorrect
          ? remaining.map((a, i) => ({ ...a, es_correcta: i === 0 }))
          : remaining;

        return { ...q, alternativas: normalized };
      })
    );
  };
  // ---- fin edición ----

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
          <QuestionBank
            onAddQuestion={handleAddFromBank}
            selectedQuestionIds={testQuestions.map((q) => q.id)}
          />

          <TestBuilder
            questions={testQuestions}
            onRemove={removeQuestion}
            onUpdateQuestionText={updateQuestionText}
            onUpdateAlternativeText={updateAlternativeText}
            onSetCorrectAlternative={setCorrectAlternative}
            onAddAlternative={addAlternative}
            onRemoveAlternative={removeAlternative}
          />

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
