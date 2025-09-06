// RUTA: src/components/pdf/TestDocument.tsx

import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { SelectedQuestion } from '@/types';

// Registrar fuentes (opcional pero recomendado para consistencia)
// Puedes añadir archivos de fuentes a tu proyecto si lo deseas.
// Por ahora, usaremos las fuentes predeterminadas.
/*
Font.register({
  family: 'Oswald',
  src: 'https://fonts.gstatic.com/s/oswald/v13/Y_TKV6o8WovbUd3m_X9aAA.ttf'
});
*/

// Definir los estilos del documento PDF
const styles = StyleSheet.create({
  page: {
    padding: '40px 30px',
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: '#333',
  },
  header: {
    marginBottom: 20,
    textAlign: 'center',
    borderBottom: '1px solid #ccc',
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
  },
  questionContainer: {
    marginBottom: 15,
  },
  questionNumber: {
    fontWeight: 'bold',
    marginRight: 5,
  },
  questionText: {
    marginBottom: 8,
    display: 'flex',
    flexDirection: 'row',
  },
  optionsContainer: {
    paddingLeft: 20,
  },
  option: {
    marginBottom: 5,
    display: 'flex',
    flexDirection: 'row',
  },
  optionLetter: {
    marginRight: 5,
    width: 15,
  },
  answerSheet: {
    marginTop: 30,
    borderTop: '2px solid #333',
    paddingTop: 15,
  },
  answerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  answerGrid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  answerItem: {
    width: '20%',
    padding: 5,
    fontSize: 10,
  },
});

interface TestDocumentProps {
  title: string;
  subtitle: string;
  questions: SelectedQuestion[];
  includeAnswers: boolean;
}

const TestDocument: React.FC<TestDocumentProps> = ({ title, subtitle, questions, includeAnswers }) => {
  const optionLetters = ['a)', 'b)', 'c)', 'd)'];

  // Mezclar las opciones para cada pregunta para que la correcta no sea siempre la primera
  const questionsWithShuffledOptions = questions.map(q => {
    const options = [q.correctAnswer, ...q.incorrectAnswers];
    // Una forma simple de mezclar basado en el ID de la pregunta para que sea consistente
    const shuffled = options.sort(() => q.id.localeCompare(Math.random().toString()));
    return { ...q, shuffledOptions: shuffled };
  });

  return (
    <Document title={title}>
      {/* Página de la Prueba */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {questionsWithShuffledOptions.map((q, index) => (
          <View key={q.dndId} style={styles.questionContainer} wrap={false}>
            <View style={styles.questionText}>
              <Text style={styles.questionNumber}>{index + 1}.</Text>
              <Text>{q.question}</Text>
            </View>
            <View style={styles.optionsContainer}>
              {q.shuffledOptions.map((option, i) => (
                <View key={i} style={styles.option}>
                  <Text style={styles.optionLetter}>{optionLetters[i]}</Text>
                  <Text>{option}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </Page>

      {/* Página de Respuestas (si está habilitada) */}
      {includeAnswers && (
        <Page size="A4" style={styles.page}>
          <View style={styles.answerSheet}>
            <Text style={styles.answerTitle}>Hoja de Respuestas - {title}</Text>
            <View style={styles.answerGrid}>
              {questionsWithShuffledOptions.map((q, index) => {
                const correctOptionIndex = q.shuffledOptions.findIndex(opt => opt === q.correctAnswer);
                const correctLetter = optionLetters[correctOptionIndex];
                return (
                  <View key={q.dndId} style={styles.answerItem}>
                    <Text>{index + 1}. {correctLetter}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </Page>
      )}
    </Document>
  );
};

export default TestDocument;
