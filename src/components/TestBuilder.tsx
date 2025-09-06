import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pregunta } from '../types';
import { GripVertical, Trash2 } from 'lucide-react';

// Componente para una pregunta individual dentro del constructor
const SortableQuestionItem = ({ question, onRemove }: { question: Pregunta, onRemove: (id: string) => void }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: question.id, data: { from: 'builder', question } });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3 border rounded-md bg-white shadow-sm flex items-start ${isDragging ? 'dragging' : ''}`}
    >
      <div {...attributes} {...listeners} className="cursor-grab p-1 mr-2">
        <GripVertical className="h-5 w-5 text-gray-400" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-sm text-gray-800">{question.texto}</p>
        <p className="text-xs text-gray-500 mt-1 pl-2 border-l-2">
          {question.alternativas.find(alt => alt.es_correcta)?.texto || "Sin respuesta correcta"}
        </p>
      </div>
      <button onClick={() => onRemove(question.id)} className="ml-2 p-1 text-red-500 hover:text-red-700">
        <Trash2 className="h-5 w-5" />
      </button>
    </div>
  );
};


interface TestBuilderProps {
  questions: Pregunta[];
  onRemove: (id: string) => void;
}

const TestBuilder: React.FC<TestBuilderProps> = ({ questions, onRemove }) => {
  const { setNodeRef, isOver } = useDroppable({ id: 'test-builder-area' });

  return (
    <div className="lg:col-span-5 bg-white p-4 rounded-lg shadow-md flex flex-col">
      <h2 className="text-xl font-bold mb-1 text-gray-800">Constructor de la Prueba</h2>
      <p className="text-sm text-gray-500 mb-4">Arrastra las preguntas para reordenarlas o elimínalas de la prueba.</p>
      
      <ScrollArea 
        ref={setNodeRef} 
        className={`flex-1 p-3 rounded-lg border-2 border-dashed transition-colors ${isOver ? 'over' : 'border-gray-300'}`}
      >
        <div className="space-y-2">
            <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
              {questions.length > 0 ? (
                questions.map(q => <SortableQuestionItem key={q.id} question={q} onRemove={onRemove} />)
              ) : (
                <div className="text-center text-gray-500 py-16">
                  <p>Arrastra preguntas aquí para comenzar</p>
                </div>
              )}
            </SortableContext>
        </div>
      </ScrollArea>
    </div>
  );
};

export default TestBuilder;
