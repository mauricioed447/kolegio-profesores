// RUTA EN TU REPO: src/components/builder/AIGeneratorPanel.tsx
// ACCIÓN: REEMPLAZAR el archivo existente

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Plus, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { GradoInfo, AsignaturaInfo, OAResumen, Dificultad, PreguntaGenerada, AppQuestion } from '@/types/ai';
import { mapGeneratedToApp } from '@/lib/ai/mapGeneratedToApp';

interface AIGeneratorPanelProps {
  onAddQuestionsBulk: (qs: AppQuestion[]) => void;
  currentQuestionCount: number;
}

const DIFICULTADES: { value: Dificultad; label: string; desc: string }[] = [
  { value: 'Auto',        label: 'Automático', desc: 'Mezcla según distribución recomendada por asignatura' },
  { value: 'Superficial', label: 'Superficial', desc: 'Recordar · Comprender' },
  { value: 'Medio',       label: 'Medio',       desc: 'Aplicar · Analizar' },
  { value: 'Profundo',    label: 'Profundo',    desc: 'Analizar · Evaluar' },
];

const CANTIDADES = [3, 5, 7, 10];

export const AIGeneratorPanel: React.FC<AIGeneratorPanelProps> = ({
  onAddQuestionsBulk,
  currentQuestionCount,
}) => {
  // Selecciones en cascada
  const [grados, setGrados]                   = useState<GradoInfo[]>([]);
  const [selectedGrado, setSelectedGrado]     = useState('');
  const [selectedAsignatura, setSelectedAsignatura] = useState('');
  const [selectedEje, setSelectedEje]         = useState('');
  const [soloBasal, setSoloBasal]             = useState(false);
  const [oas, setOas]                         = useState<OAResumen[]>([]);
  const [selectedOA, setSelectedOA]           = useState('');
  const [dificultad, setDificultad]           = useState<Dificultad>('Auto');
  const [cantidad, setCantidad]               = useState(5);

  // Estado UI
  const [loadingGrados, setLoadingGrados]     = useState(true);
  const [loadingOAs, setLoadingOAs]           = useState(false);
  const [generating, setGenerating]           = useState(false);
  const [generatingMore, setGeneratingMore]   = useState(false);
  const [error, setError]                     = useState('');
  const [lastGenerated, setLastGenerated]     = useState(0);
  const [showOADetail, setShowOADetail]       = useState(false);
  const [oaSeleccionado, setOaSeleccionado]   = useState<OAResumen | null>(null);

  // Cargar grados al montar
  useEffect(() => {
    setLoadingGrados(true);
    fetch('/api/get-grados')
      .then((r) => r.json())
      .then((data) => setGrados(data.grados ?? []))
      .catch(() => setError('No se pudieron cargar los grados'))
      .finally(() => setLoadingGrados(false));
  }, []);

  // Cargar OAs cuando cambia grado, asignatura, eje o filtro basal
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

    const params = new URLSearchParams({
      grado:      selectedGrado,
      asignatura: selectedAsignatura,
    });
    if (selectedEje)  params.set('eje', selectedEje);
    if (soloBasal)    params.set('solo_basal', 'true');

    fetch(`/api/get-oas?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setOas(data.oas ?? []))
      .catch(() => setError('No se pudieron cargar los OAs'))
      .finally(() => setLoadingOAs(false));
  }, [selectedGrado, selectedAsignatura, selectedEje, soloBasal]);

  // Info de la asignatura seleccionada
  const gradoInfo = grados.find((g) => g.grado === selectedGrado);
  const asignaturas: AsignaturaInfo[] = gradoInfo?.asignaturas ?? [];
  const asigInfo = asignaturas.find((a) => a.nombre === selectedAsignatura);
  const ejesDisponibles: string[] = asigInfo?.ejes ?? [];
  const tieneEjes = (asigInfo?.tiene_ejes || asigInfo?.tiene_modulos) && ejesDisponibles.length > 0;

  // Handlers en cascada
  const handleGradoChange = (val: string) => {
    setSelectedGrado(val);
    setSelectedAsignatura('');
    setSelectedEje('');
    setSoloBasal(false);
    setOas([]);
    setSelectedOA('');
    setOaSeleccionado(null);
    setLastGenerated(0);
    setError('');
  };

  const handleAsignaturaChange = (val: string) => {
    setSelectedAsignatura(val);
    setSelectedEje('');
    setSoloBasal(false);
    setSelectedOA('');
    setOaSeleccionado(null);
    setLastGenerated(0);
    setError('');
  };

  const handleEjeChange = (val: string) => {
    setSelectedEje(val === '__todos__' ? '' : val);
    setSelectedOA('');
    setOaSeleccionado(null);
    setLastGenerated(0);
    setError('');
  };

  const handleOAChange = (val: string) => {
    setSelectedOA(val);
    setLastGenerated(0);
    setError('');
    setOaSeleccionado(oas.find((o) => o.codigo === val) ?? null);
  };

  const handleBasalToggle = () => {
    setSoloBasal((v) => !v);
    setSelectedOA('');
    setOaSeleccionado(null);
  };

  // Verificar si la asignatura tiene OAs basales
  const tieneOAsBasales = oas.some((o) => o.basal) || !soloBasal;
  const sinBasales = soloBasal && oas.length === 0 && !loadingOAs && selectedAsignatura;

  // Generar preguntas
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
            codigo_oa:   selectedOA,
            dificultad,
            cantidad:    esAdicional ? 5 : cantidad,
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

  const canGenerate    = selectedOA && !generating && !generatingMore;
  const showGenerarMas = lastGenerated > 0 && !generating;

  // Etiqueta del eje para mostrarlo en el selector de OA
  const ejeLabel = selectedEje
    ? ` · ${selectedEje}`
    : tieneEjes ? ' · Todos los ejes' : '';

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
          {asignaturas.map((a) => (
            <SelectItem key={a.nombre} value={a.nombre}>
              {a.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Eje — solo si la asignatura tiene ejes o módulos */}
      {tieneEjes && (
        <Select
          value={selectedEje || '__todos__'}
          onValueChange={handleEjeChange}
          disabled={!selectedAsignatura}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecciona un Eje" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos__">Todos los ejes</SelectItem>
            {ejesDisponibles.map((eje) => (
              <SelectItem key={eje} value={eje}>
                {eje}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Filtro Basal */}
      {selectedAsignatura && (
        <button
          onClick={handleBasalToggle}
          className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
            soloBasal
              ? 'bg-amber-50 border-amber-400 text-amber-700'
              : 'bg-background border-input text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
            soloBasal ? 'bg-amber-400 border-amber-400' : 'border-input'
          }`}>
            {soloBasal && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
          Solo Objetivos Basales
        </button>
      )}

      {/* Aviso sin OAs basales */}
      {sinBasales && (
        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-500 text-center">
          Esta asignatura no registra Objetivos de Aprendizaje Basales
        </div>
      )}

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
              <SelectValue
                placeholder={
                  oas.length === 0 && selectedAsignatura && !sinBasales
                    ? 'Sin OAs disponibles'
                    : `Selecciona un Objetivo${ejeLabel}`
                }
              />
            </SelectTrigger>
            <SelectContent className="max-w-sm">
              {oas.map((oa) => (
                <SelectItem key={oa.codigo} value={oa.codigo}>
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 mt-0.5">
                      {oa.codigo}
                      {oa.basal && (
                        <span className="ml-1 text-amber-500" title="Objetivo Basal">●</span>
                      )}
                    </span>
                    <span className="text-sm leading-snug break-words">{oa.descripcion_corta}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Detalle expandible del OA seleccionado */}
        {oaSeleccionado && (
          <button
            className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowOADetail((v) => !v)}
          >
            {showOADetail ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showOADetail ? 'Ocultar descripción' : 'Ver descripción completa'}
          </button>
        )}
        {showOADetail && oaSeleccionado && (
          <div className="mt-1 p-2 bg-slate-50 rounded text-xs text-slate-700 border border-slate-200 leading-relaxed">
            <span className="font-mono font-semibold text-slate-500 mr-1">{oaSeleccionado.codigo}</span>
            {oaSeleccionado.descripcion_corta}
            {oaSeleccionado.basal && (
              <span className="ml-2 inline-block px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                Basal
              </span>
            )}
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
              <span className="font-medium">{d.label}</span>
              <span className="text-xs text-muted-foreground ml-2">{d.desc}</span>
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

      {/* Botón Generar */}
      <Button
        onClick={() => doGenerate(false)}
        disabled={!canGenerate}
        className="w-full gap-2"
      >
        <Sparkles className="h-4 w-4" />
        {generating ? 'Generando…' : `Generar ${cantidad} preguntas`}
      </Button>

      {/* Botón Generar más */}
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

      {/* Contador */}
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
