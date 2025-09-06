// RUTA: src/components/pdf/PDFPreview.tsx

import React, { useState, useEffect } from 'react';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import TestDocument from './TestDocument';
import { SelectedQuestion } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, X, Loader2 } from 'lucide-react';

interface PDFPreviewProps {
  title: string;
  subtitle: string;
  questions: SelectedQuestion[];
  includeAnswers: boolean;
  onClose: () => void;
}

const PDFPreview: React.FC<PDFPreviewProps> = ({ title, subtitle, questions, includeAnswers, onClose }) => {
  const [isClient, setIsClient] = useState(false);

  // react-pdf/renderer solo funciona en el lado del cliente.
  // Este efecto asegura que el componente solo se renderice después de que la página se haya cargado en el navegador.
  useEffect(() => {
    setIsClient(true);
  }, []);

  const fileName = `${title.replace(/ /g, '_')}.pdf`;
  const document = (
    <TestDocument
      title={title}
      subtitle={subtitle}
      questions={questions}
      includeAnswers={includeAnswers}
    />
  );

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Vista Previa del PDF</CardTitle>
            <CardDescription>Revisa el documento antes de descargar.</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col bg-gray-200">
        {isClient ? (
          <>
            <div className="flex-1 h-0">
              <PDFViewer style={{ width: '100%', height: '100%', border: 'none' }}>
                {document}
              </PDFViewer>
            </div>
            <div className="mt-4 flex justify-end">
              <PDFDownloadLink document={document} fileName={fileName}>
                {({ loading }) => (
                  <Button disabled={loading}>
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    {loading ? 'Generando...' : 'Descargar PDF'}
                  </Button>
                )}
              </PDFDownloadLink>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="ml-2">Cargando previsualización...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PDFPreview;
