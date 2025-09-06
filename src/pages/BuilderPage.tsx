// RUTA: src/pages/BuilderPage.tsx

import React, { useState } from 'react';
import { SelectedQuestion } from '@/types';

// Importaremos estos componentes en los siguientes pasos
import QuestionBank from '@/components/builder/QuestionBank';
import SelectedQuestions from '@/components/builder/SelectedQuestions';
import TestConfig from '@/components/builder/TestConfig';

const BuilderPage: React.FC = () => {
  const [selectedQuestions, setSelectedQuestions] = useState<SelectedQuestion[]>([]);
  const [testTitle, setTestTitle] = useState('Prueba de Historia');
  const [testSubtitle, setTestSubtitle] = useState('Nombre: __________ Curso: __________ Fecha: __________');

  const handleAddQuestion = (question: SelectedQuestion) => {
    // Evitar añadir la misma pregunta dos veces
    if (!selectedQuestions.some(q => q.id === question.id)) {
      setSelectedQuestions(prev => [...prev, question]);
    }
  };

  const handleRemoveQuestion = (dndId: string) => {
    setSelectedQuestions(prev => prev.filter(q => q.dndId !== dndId));
  };

  const handleReorderQuestions = (reorderedQuestions: SelectedQuestion[]) => {
    setSelectedQuestions(reorderedQuestions);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <img src="/kolegio-logo.png" alt="Kolegio Logo" className="h-8" />
          <h1 className="text-xl font-semibold text-gray-800">Kolegio Test Builder</h1>
        </div>
      </header>
      
      <main className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">
          
          {/* Panel Izquierdo: Banco de Preguntas */}
          <div className="lg:col-span-4 xl:col-span-3 h-full">
            <QuestionBank onAddQuestion={handleAddQuestion} selectedQuestionIds={selectedQuestions.map(q => q.id)} />
          </div>

          {/* Panel Central: Constructor de Prueba */}
          <div className="lg:col-span-5 xl:col-span-6 h-full">
            <SelectedQuestions
              questions={selectedQuestions}
              onRemoveQuestion={handleRemoveQuestion}
              onReorderQuestions={handleReorderQuestions}
            />
          </div>

          {/* Panel Derecho: Configuración y Previsualización */}
          <div className="lg:col-span-3 xl:col-span-3 h-full">
            <TestConfig
              title={testTitle}
              subtitle={testSubtitle}
              onTitleChange={setTestTitle}
              onSubtitleChange={setTestSubtitle}
              selectedQuestions={selectedQuestions}
            />
          </div>

        </div>
      </main>
    </div>
  );
};

export default BuilderPage;
