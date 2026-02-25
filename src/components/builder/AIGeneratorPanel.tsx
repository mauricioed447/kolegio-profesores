import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Plus, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { GradoInfo, OAResumen, Dificultad, PreguntaGenerada, AppQuestion } from '@/types/ai';
import { mapGeneratedToApp } from '@/lib/ai/mapGeneratedToApp';

interface AIGeneratorPanelProps {
  onAddQuestionsBulk: (qs: AppQuestion[]) => void;
  currentQuestionCount: number;
}

const DIFICULTADES: { value: Dificultad; label: string; desc: string }[] = [
  { value: 'Auto', label: 'Automático', desc: 'Mezcla según distribución recomendada por asignatura' },
  { value: 'Superficial', label: 'Superficial', desc: 'Recordar · Comprender' },
  { value: 'Medio', label: 'Medio', desc: 'Aplicar · Analizar' },
  { value: 'Profundo', label: 'Profundo', desc: 'Analizar · Evaluar' },
];

const CANTIDADES = [3, 5, 7, 10];

export const AIGeneratorPanel: React.FC<AIGeneratorPanelProps> = ({
  onAddQuestionsBulk,
  currentQuestionCount,
}) => {
  // Selecciones
  const [grados, setGrados] = useState<GradoInfo[]>([]);
  const [selectedGrado, setSelectedGrado] = useState('');
  const [selectedAsignatura, setSelectedAsignatura] = useState('');
  const [oas, setOas] = useState<OAResumen[]>([]);
  const [selectedOA, setSelectedOA] = useState('');
  const [dificultad, setDificultad] = useState<Dificultad>('Auto');
  const [cantidad, setCantidad] = useState(5);

  // Estado UI
  const [loadingGrados, setLoadingGrados] = useState(true);
  const [loadingOAs, setLoadingOAs] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingMore, setGeneratingMore] = useState(false);
  const [error, setError] = useState('');
  const [lastGenerated, setLastGenerated] = useState(0);
  const [showOADetail, setShowOADetail] = useState(false);
  const [oaSeleccionado, setOaSeleccionado] = useState<OAResumen | null>(null);

  // Cargar grados al montar
  useEffect(() => {
    setLoadingGrados(true);
    fetch('/api/get-grados')
      .then((r) => r.json())
      .then((data) => setGrados(data.grados ?? []))
      .catch(() => setError('No se pudieron cargar los grados'))
      .finally(() => setLoadingGrados(false));
  }, []);

  // Cargar OAs cuando cambia grado + asignatura
  useEffect(() => {
    if (!selectedGrado || !selectedAsignatura) {
      setOas([]);
      setSelectedOA('');
      setOaSeleccionado(null);
      return;
    }
    setLoadingOAs(true);
    setSelectedOA('');
    setOaSeleccionado(null);
    fetch(`/api/get-oas?grado=${encodeURIComponent(selectedGrado)}&asignatura=${encodeURIComponent(selectedAsignatura)}`)
      .then((r) => r.json())
      .then((data) => setOas(data.oas ?? []))
      .catch(() => setError('No se pudieron cargar los OAs'))
      .finally(() => setLoadingOAs(false));
  }, [selectedGrado, selectedAsignatura]);

  // Cuando cambia grado, resetear asignatura
  const handleGradoChange = (val: string) => {
    setSelectedGrado(val);
    setSelectedAsignatura('');
    setOas([]);
    setSelectedOA('');
    setOaSeleccionado(null);
    setLastGenerated(0);
    setError('');
  };

  const handleAsignaturaChange = (val: string) => {
    setSelectedAsignatura(val);
    setSelectedOA('');
    setOaSeleccionado(null);
    setLastGenerated(0);
    setError('');
  };

  const handleOAChange = (val: string) => {
    setSelectedOA(val);
    setLastGenerated(0);
    setError('');
    const oa = oas.find((o) => o.codigo === val) ?? null;
    setOaSeleccionado(oa);
  };

  const asignaturasDisponibles =
    grados.find((g) => g.grado === selectedGrado)?.asignaturas ?? [];

  const doGenerate = useCallback(
    async (esAdicional = false) => {
      if (!selectedOA) return;
      setError('');
      if (esAdicional) setGeneratingMore(true);
      else setGenerating(true);

      try {
        const r = await fetch('/api/generate-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codigo_oa: selectedOA,
            dificultad,
            cantidad: esAdicional ? 5 : cantidad,
            es_adicional: esAdicional,
          }),
        });

        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err?.error ?? `Error ${r.status}`);
        }

        const data = (await r.json()) as PreguntaGenerada[];
        const appQs = mapGeneratedToApp(data);

        if (!appQs.length) {
          throw new Error('La IA no generó preguntas válidas. Intenta de nuevo.');
        }

        onAddQuestionsBulk(appQs);
        setLastGenerated((prev) => prev + appQs.length);
      } catch (e: any) {
        setError(e?.message ?? 'Error al generar preguntas');
      } finally {
        setGenerating(false);
        setGeneratingMore(false);
      }
    },
    [selectedOA, dificultad, cantidad, onAddQuestionsBulk]
  );

  const canGenerate = selectedOA && !generating && !generatingMore;
  const showGenerarMas = lastGenerated > 0 && !generating;

  return (
    <div className="flex flex-col gap-3 p-1">

      {/* Grado */}
      {loadingGrados ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <Select value={selectedGrado} onValueChange={handleGradoChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona un Grado" />
          </SelectTrigger>
          <SelectContent>
            {grados.map((g) => (
              <SelectItem key={g.grado} value={g.grado}>
                {g.grado}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Asignatura */}
      <Select
        value={selectedAsignatura}
        onValueChange={handleAsignaturaChange}
        disabled={!selectedGrado || loadingGrados}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecciona una Asignatura" />
        </SelectTrigger>
        <SelectContent>
          {asignaturasDisponibles.map((a) => (
            <SelectItem key={a} value={a}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* OA */}
      <div>
        {loadingOAs ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <Select
            value={selectedOA}
            onValueChange={handleOAChange}
            disabled={!selectedAsignatura || oas.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={oas.length === 0 && selectedAsignatura ? 'Sin OAs disponibles' : 'Selecciona un Objetivo de Aprendizaje'} />
            </SelectTrigger>
            <SelectContent className="max-w-sm">
              {oas.map((oa) => (
                <SelectItem key={oa.codigo} value={oa.codigo}>
                  <span className="font-mono text-xs text-muted-foreground mr-2">{oa.codigo}</span>
                  {oa.descripcion_corta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Detalle del OA seleccionado */}
        {oaSeleccionado && (
          <button
            className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowOADetail((v) => !v)}
          >
            {showOADetail ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showOADetail ? 'Ocultar detalle' : 'Ver descripción del OA'}
          </button>
        )}
        {showOADetail && oaSeleccionado && (
          <div className="mt-1 p-2 bg-slate-50 rounded text-xs text-slate-600 border border-slate-200">
            {oaSeleccionado.descripcion_corta}
          </div>
        )}
      </div>

      {/* Dificultad */}
      <Select
        value={dificultad}
        onValueChange={(v) => setDificultad(v as Dificultad)}
        disabled={!selectedOA}
      >
        <SelectTrigger>
          <SelectValue placeholder="Dificultad" />
        </SelectTrigger>
        <SelectContent>
          {DIFICULTADES.map((d) => (
            <SelectItem key={d.value} value={d.value}>
              <div>
                <span className="font-medium">{d.label}</span>
                <span className="text-xs text-muted-foreground ml-2">{d.desc}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Cantidad */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1">
          Cantidad de preguntas
        </label>
        <div className="flex gap-2">
          {CANTIDADES.map((n) => (
            <button
              key={n}
              onClick={() => setCantidad(n)}
              disabled={!selectedOA}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                cantidad === n
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-input hover:bg-accent disabled:opacity-40'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Botón principal Generar */}
      <Button
        onClick={() => doGenerate(false)}
        disabled={!canGenerate}
        className="w-full gap-2"
      >
        <Sparkles className="h-4 w-4" />
        {generating ? 'Generando…' : `Generar ${cantidad} preguntas`}
      </Button>

      {/* Botón Generar más (aparece tras primera generación) */}
      {showGenerarMas && (
        <Button
          variant="outline"
          onClick={() => doGenerate(true)}
          disabled={generatingMore || generating}
          className="w-full gap-2 text-sm"
        >
          <Plus className="h-4 w-4" />
          {generatingMore ? 'Generando…' : 'Generar 5 más'}
        </Button>
      )}

      {/* Contador informativo */}
      {lastGenerated > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {lastGenerated} pregunta{lastGenerated !== 1 ? 's' : ''} generada{lastGenerated !== 1 ? 's' : ''} en esta sesión
          {currentQuestionCount > 0 ? ` · ${currentQuestionCount} en la prueba` : ''}
        </p>
      )}
    </div>
  );
};

export default AIGeneratorPanel;
