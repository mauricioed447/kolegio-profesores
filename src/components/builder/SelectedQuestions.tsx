// RUTA: src/components/builder/SelectedQuestions.tsx

import React from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GripVertical, X } from 'lucide-react';
import { SelectedQuestion } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SelectedQuestionsProps {
  questions: SelectedQuestion[];
  onRemoveQuestion: (dndId: string) => void;
  onReorderQuestions: (reorderedQuestions: SelectedQuestion[]) => void;
}

// Sub-componente para un item individual que se puede arrastrar
const SortableQuestionItem: React.FC<{ question: SelectedQuestion; onRemove: (dndId: string) => void }> = ({ question, onRemove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: question.dndId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 bg-white border rounded-md shadow-sm"
    >
      <button {...attributes} {...listeners} className="cursor-grab p-1 text-gray-500 hover:bg-gray-100 rounded">
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex-1">
        <p className="text-sm">{question.question}</p>
        <p className="text-xs text-muted-foreground">R: {question.correctAnswer}</p>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemove(question.dndId)}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};


const SelectedQuestions: React.FC<SelectedQuestionsProps> = ({ questions, onRemoveQuestion, onReorderQuestions }) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = questions.findIndex(q => q.dndId === active.id);
      const newIndex = questions.findIndex(q => q.dndId === over.id);
      onReorderQuestions(arrayMove(questions, oldIndex, newIndex));
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Constructor de la Prueba</CardTitle>
        <CardDescription>Arrastra las preguntas para reordenarlas o elimínalas de la prueba.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-2">
        <ScrollArea className="h-full p-4">
          {questions.length === 0 ? (
            <div className="flex items-center justify-center h-full border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground">Añade preguntas desde el panel izquierdo.</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={questions.map(q => q.dndId)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {questions.map((q) => (
                    <SortableQuestionItem key={q.dndId} question={q} onRemove={onRemoveQuestion} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default SelectedQuestions;
