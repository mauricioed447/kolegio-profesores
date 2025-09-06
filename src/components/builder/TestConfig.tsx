// RUTA: src/components/builder/TestConfig.tsx

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SelectedQuestion } from '@/types';
import PDFPreview from '@/components/pdf/PDFPreview'; // Lo crearemos a continuación

interface TestConfigProps {
  title: string;
  subtitle: string;
  onTitleChange: (title: string) => void;
  onSubtitleChange: (subtitle: string) => void;
  selectedQuestions: SelectedQuestion[];
}

const TestConfig: React.FC<TestConfigProps> = ({
  title,
  subtitle,
  onTitleChange,
  onSubtitleChange,
  selectedQuestions,
}) => {
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  const handleGenerateClick = () => {
    if (selectedQuestions.length > 0) {
      setShowPreview(true);
    } else {
      alert("Por favor, selecciona al menos una pregunta para generar la prueba.");
    }
  };

  if (showPreview) {
    return (
      <PDFPreview
        title={title}
        subtitle={subtitle}
        questions={selectedQuestions}
        includeAnswers={includeAnswers}
        onClose={() => setShowPreview(false)}
      />
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Configuración y Vista Previa</CardTitle>
        <CardDescription>Define los detalles de tu prueba y genera el PDF.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between">
        <div className="space-y-4">
          <div>
            <Label htmlFor="test-title">Título de la Prueba</Label>
            <Input
              id="test-title"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="test-subtitle">Encabezado (Subtítulo/Descripción)</Label>
            <Input
              id="test-subtitle"
              value={subtitle}
              onChange={(e) => onSubtitleChange(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-2 pt-2">
            <Switch
              id="include-answers"
              checked={includeAnswers}
              onCheckedChange={setIncludeAnswers}
            />
            <Label htmlFor="include-answers">Incluir Hoja de Respuestas</Label>
          </div>
        </div>
        <Button
          onClick={handleGenerateClick}
          className="w-full mt-4"
          disabled={selectedQuestions.length === 0}
        >
          Generar y Previsualizar PDF
        </Button>
      </CardContent>
    </Card>
  );
};

export default TestConfig;
