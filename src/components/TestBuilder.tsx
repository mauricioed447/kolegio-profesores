import React from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GripVertical, Trash2, Plus, X } from 'lucide-react';

import type { PreguntaApp } from '@/App';

type Props = {
  questions: PreguntaApp[];
  onRemove: (id: string) => void;
  onUpdateQuestionText: (qId: string, newText: string) => void;
  onUpdateAlternativeText: (qId: string, altId: string, newText: string) => void;
  onSetCorrectAlternative: (qId: string, altId: string) => void;
  onAddAlternative: (qId: string) => void;
  onRemoveAlternative: (qId: string, altId: string) => void;
};

const SortableQuestionRow: React.FC<
  React.PropsWithChildren<{ id: string }>
> = ({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id,
    data: { from: 'builder' },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="mb-3">
      <div className="flex items-center gap-2 mb-2">
        <button
          {...listeners}
          className="p-1 rounded hover:bg-muted text-muted-foreground cursor-grab active:cursor-grabbing"
          aria-label="Reordenar"
          title="Reordenar"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  );
};

const TestBuilder: React.FC<Props> = ({
  questions,
  onRemove,
  onUpdateQuestionText,
  onUpdateAlternativeText,
  onSetCorrectAlternative,
  onAddAlternative,
  onRemoveAlternative,
}) => {
  return (
    <Card className="lg:col-span-5 h-full">
      <CardHeader>
        <CardTitle>Constructor de la Prueba</CardTitle>
      </CardHeader>
      <CardContent>
        {questions.length === 0 && (
          <div
            id="test-builder-area"
            className="h-40 border-2 border-dashed rounded-md flex items-center justify-center text-sm text-muted-foreground"
          >
            Agrega preguntas con el botón “+” desde la izquierda.
          </div>
        )}

        {questions.length > 0 && (
          <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            {questions.map((q, idx) => (
              <SortableQuestionRow id={q.id} key={q.id}>
                <div className="border rounded-lg bg-white shadow-sm">
                  <div className="flex items-start justify-between p-3 border-b">
                    <div className="text-sm font-semibold">{idx + 1}.</div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600"
                      onClick={() => onRemove(q.id)}
                      title="Eliminar pregunta"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="p-3 space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">
                        Pregunta
                      </label>
                      {/* textarea nativo estilizado */}
                      <textarea
                        value={q.texto}
                        onChange={(e) => onUpdateQuestionText(q.id, e.target.value)}
                        rows={3}
                        className="w-full min-h-[72px] text-sm border rounded-md bg-background p-2 outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground block mb-2">
                        Alternativas (marca la correcta)
                      </label>
                      <div className="space-y-2">
                        {q.alternativas.map((a, i) => (
                          <div
                            key={a.id}
                            className="flex items-center gap-2"
                          >
                            {/* radio correcta */}
                            <input
                              type="radio"
                              name={`correct-${q.id}`}
                              checked={a.es_correcta}
                              onChange={() => onSetCorrectAlternative(q.id, a.id)}
                              className="h-4 w-4"
                              aria-label="Marcar como correcta"
                            />
                            {/* texto alternativa */}
                            <Input
                              value={a.texto}
                              onChange={(e) =>
                                onUpdateAlternativeText(q.id, a.id, e.target.value)
                              }
                              className="flex-1"
                            />
                            {/* eliminar alternativa */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => onRemoveAlternative(q.id, a.id)}
                              title="Eliminar alternativa"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <span className="text-xs text-muted-foreground w-5 text-right">
                              {String.fromCharCode(97 + i)})
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onAddAlternative(q.id)}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Agregar alternativa
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </SortableQuestionRow>
            ))}
          </SortableContext>
        )}
      </CardContent>
    </Card>
  );
};

export default TestBuilder;
