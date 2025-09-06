import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { FileDown } from 'lucide-react';

interface ConfigurationProps {
    title: string;
    setTitle: (value: string) => void;
    header: string;
    setHeader: (value: string) => void;
    includeAnswerSheet: boolean;
    setIncludeAnswerSheet: (value: boolean) => void;
    onGeneratePdf: () => void;
    isTestEmpty: boolean;
}

const Configuration: React.FC<ConfigurationProps> = ({
    title, setTitle, header, setHeader,
    includeAnswerSheet, setIncludeAnswerSheet,
    onGeneratePdf, isTestEmpty
}) => {
  return (
    <div className="lg:col-span-4 bg-white p-4 rounded-lg shadow-md flex flex-col space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1 text-gray-800">Configuración y Vista Previa</h2>
        <p className="text-sm text-gray-500">Define los detalles de tu prueba y genera el PDF.</p>
      </div>
      
      <div className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="test-title">Título de la Prueba</Label>
            <Input id="test-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Funciones del cuerpo humano"/>
        </div>
        <div className="space-y-2">
            <Label htmlFor="test-header">Encabezado (Subtítulo/Descripción)</Label>
            <Input id="test-header" value={header} onChange={(e) => setHeader(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center space-x-2 pt-2">
        <Switch id="answer-sheet" checked={includeAnswerSheet} onCheckedChange={setIncludeAnswerSheet} />
        <Label htmlFor="answer-sheet">Incluir Hoja de Respuestas</Label>
      </div>

      <div className="flex-grow flex items-end">
        <Button 
            onClick={onGeneratePdf} 
            className="w-full"
            disabled={isTestEmpty}
        >
          <FileDown className="mr-2 h-4 w-4" />
          {isTestEmpty ? "Añade preguntas primero" : "Generar PDF"}
        </Button>
      </div>
    </div>
  );
};

export default Configuration;
