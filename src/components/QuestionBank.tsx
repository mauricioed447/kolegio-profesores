import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Nivel, Materia, Unidad, Pregunta } from '../types';
import { Loader2, PlusCircle } from 'lucide-react';

// Componente para una pregunta individual arrastrable
const DraggableQuestionItem = ({ question }: { question: Pregunta }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: question.id,
    data: { from: 'bank', question },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`p-3 border rounded-md bg-white shadow-sm cursor-grab hover:bg-slate-50 flex justify-between items-start ${isDragging ? 'dragging' : ''}`}
    >
      <div className="flex-1">
        <p className="font-medium text-sm text-gray-800">{question.texto}</p>
        <div className="text-xs text-gray-500 mt-1 pl-2 border-l-2">
            {question.alternativas.map(alt => (
                <p key={alt.id} className={alt.es_correcta ? 'font-bold text-green-600' : ''}>
                    {alt.texto}
                </p>
            ))}
        </div>
      </div>
      <PlusCircle className="h-5 w-5 text-gray-400 ml-2 flex-shrink-0" />
    </div>
  );
};


interface QuestionBankProps {
    niveles: Nivel[];
    materias: Materia[];
    unidades: Unidad[];
    preguntas: Pregunta[];
    selectedNivel: string | null;
    setSelectedNivel: (value: string) => void;
    selectedMateria: string | null;
    setSelectedMateria: (value: string) => void;
    selectedUnidad: string | null;
    setSelectedUnidad: (value: string) => void;
    isLoading: boolean;
}

const QuestionBank: React.FC<QuestionBankProps> = ({
    niveles, materias, unidades, preguntas,
    selectedNivel, setSelectedNivel,
    selectedMateria, setSelectedMateria,
    selectedUnidad, setSelectedUnidad,
    isLoading
}) => {
    
  const filteredMaterias = materias.filter(m => m.nivel_id === selectedNivel);
  const filteredUnidades = unidades.filter(u => u.materia_id === selectedMateria);

  return (
    <div className="lg:col-span-3 bg-white p-4 rounded-lg shadow-md flex flex-col">
      <h2 className="text-xl font-bold mb-1 text-gray-800">Banco de Preguntas</h2>
      <p className="text-sm text-gray-500 mb-4">Filtra y selecciona preguntas de los quizzes existentes.</p>
      
      <Accordion type="single" collapsible defaultValue="item-1" className="w-full mb-4">
        <AccordionItem value="item-1">
          <AccordionTrigger>Filtros de Búsqueda</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <Select onValueChange={setSelectedNivel}>
              <SelectTrigger><SelectValue placeholder="Selecciona un Nivel" /></SelectTrigger>
              <SelectContent>{niveles.map(n => <SelectItem key={n.id} value={n.id}>{n.nombre}</SelectItem>)}</SelectContent>
            </Select>
            <Select onValueChange={setSelectedMateria} disabled={!selectedNivel}>
              <SelectTrigger><SelectValue placeholder="Selecciona una Materia" /></SelectTrigger>
              <SelectContent>{filteredMaterias.map(m => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}</SelectContent>
            </Select>
            <Select onValueChange={setSelectedUnidad} disabled={!selectedMateria}>
              <SelectTrigger><SelectValue placeholder="Selecciona una Unidad" /></SelectTrigger>
              <SelectContent>{filteredUnidades.map(u => <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      
      <p className="text-sm font-semibold mb-2 text-gray-600">Preguntas Disponibles:</p>
      <ScrollArea className="flex-1 pr-3">
        <div className="space-y-2">
            {isLoading ? (
                <div className="flex justify-center items-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            ) : preguntas.length > 0 ? (
                preguntas.map(q => <DraggableQuestionItem key={q.id} question={q} />)
            ) : (
                <div className="text-center text-sm text-gray-500 py-10">
                    <p>{selectedUnidad ? "No hay preguntas en esta unidad." : "Selecciona una unidad para ver las preguntas."}</p>
                </div>
            )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default QuestionBank;
