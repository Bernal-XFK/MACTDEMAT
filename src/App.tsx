/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import { UploadCloud, Settings, FileSpreadsheet, BarChart2, Table, Info, AlertCircle, Star, ZoomIn, ZoomOut, Maximize, Target } from 'lucide-react';
import { parseExcel, analyzeMatrix, AnalysisResult, MatrixData } from './lib/mactdemat';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LabelList, Cell } from 'recharts';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Config
  const [iterations, setIterations] = useState(2);
  const [scale, setScale] = useState('auto');
  const [topN, setTopN] = useState(5);
  const [focusZone, setFocusZone] = useState('all');
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // Manual Entry State
  const [manualMode, setManualMode] = useState(false);
  const [manualStep, setManualStep] = useState(1);
  const [manualVars, setManualVars] = useState([{ id: 'V1', longName: '', shortName: '', description: '' }, { id: 'V2', longName: '', shortName: '', description: '' }]);
  const [manualMatrix, setManualMatrix] = useState<number[][]>([]);
  
  // UI State
  const [activeTab, setActiveTab] = useState('resumen');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setError(null);
    setLoading(true);
    
    try {
      const data = await parseExcel(selectedFile);
      
      // Auto-detect scale
      if (scale === 'auto') {
        let maxVal = 0;
        data.matrix.forEach(row => row.forEach(val => { if (val > maxVal) maxVal = val; }));
        setScale(`0-${maxVal}`);
      }

      setMatrixData(data);
      const analysis = analyzeMatrix(data, iterations);
      setResult(analysis);
      setActiveTab('resumen');
    } catch (err: any) {
      setError(err.message || 'Error al procesar el archivo Excel.');
      setMatrixData(null);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleReanalyze = () => {
    if (matrixData) {
      setLoading(true);
      try {
        const analysis = analyzeMatrix(matrixData, iterations);
        setResult(analysis);
      } catch (err: any) {
        setError(err.message || 'Error al re-analizar la matriz.');
      } finally {
        setLoading(false);
      }
    }
  };

  // Generate interpretation markdown
  const generateInterpretation = () => {
    if (!result) return '';
    const { indicators } = result;
    
    const motoras = indicators.filter(i => i.quadrant === 'Motora');
    const claves = indicators.filter(i => i.quadrant === 'Clave');
    const dependientes = indicators.filter(i => i.quadrant === 'Dependiente');
    const autonomas = indicators.filter(i => i.quadrant === 'Autónoma');

    let md = "### Análisis Estructural MACTDEMAT\n\n";
    
    md += "**1. Variables Clave (Alta Motricidad, Alta Dependencia)**\n";
    if (claves.length > 0) {
      md += `Se identificaron ${claves.length} variables clave: ${claves.map(v => v.name).join(', ')}. Estas variables son muy inestables; cualquier acción sobre ellas tendrá repercusiones en todo el sistema y, a su vez, serán fuertemente impactadas por cambios en otras variables. Son los puntos críticos de intervención estratégica.\n\n`;
    } else {
      md += "No se identificaron variables clave en el sistema actual.\n\n";
    }

    md += "**2. Variables Motoras / Determinantes (Alta Motricidad, Baja Dependencia)**\n";
    if (motoras.length > 0) {
      md += `Existen ${motoras.length} variables motoras: ${motoras.map(v => v.name).join(', ')}. Estas son las variables explicativas del sistema. Son muy influyentes y poco dependientes, lo que significa que actúan como frenos o motores del sistema. Las acciones estratégicas deben enfocarse aquí para generar cambios estructurales.\n\n`;
    } else {
      md += "No se identificaron variables motoras fuertes.\n\n";
    }

    md += "**3. Variables Dependientes / Resultado (Baja Motricidad, Alta Dependencia)**\n";
    if (dependientes.length > 0) {
      md += `Se encontraron ${dependientes.length} variables dependientes: ${dependientes.map(v => v.name).join(', ')}. Estas variables son el resultado del funcionamiento del sistema. Son muy sensibles a la evolución de las variables motoras y clave. No se deben atacar directamente, sino a través de las variables que las influyen.\n\n`;
    } else {
      md += "No se identificaron variables puramente dependientes.\n\n";
    }

    md += "**4. Variables Autónomas (Baja Motricidad, Baja Dependencia)**\n";
    if (autonomas.length > 0) {
      md += `Hay ${autonomas.length} variables autónomas: ${autonomas.map(v => v.name).join(', ')}. Estas variables están relativamente desconectadas del sistema. Tienen poco potencial para generar cambios y son poco afectadas por el resto. Suelen ser tendencias pasadas o factores externos con impacto marginal.\n\n`;
    } else {
      md += "No se identificaron variables autónomas.\n\n";
    }

    md += "### Recomendaciones Accionables\n";
    if (motoras.length > 0) {
      md += `- **Foco de Acción:** Priorizar políticas y recursos sobre las variables motoras (${motoras[0].name}${motoras.length > 1 ? '...' : ''}), ya que controlan la dinámica del sistema.\n`;
    }
    if (claves.length > 0) {
      md += `- **Gestión de Riesgos:** Monitorear de cerca las variables clave (${claves[0].name}${claves.length > 1 ? '...' : ''}) debido a su alta inestabilidad. Intervenciones aquí deben ser cuidadosamente planeadas.\n`;
    }
    if (dependientes.length > 0) {
      md += `- **Indicadores de Éxito:** Utilizar las variables dependientes (${dependientes[0].name}${dependientes.length > 1 ? '...' : ''}) como KPIs para medir el impacto de las acciones tomadas en las variables motoras.\n`;
    }

    return md;
  };

  const getQuadrantColor = (quadrant: string) => {
    switch (quadrant) {
      case 'Motora': return '#ef4444'; // red-500
      case 'Clave': return '#eab308'; // yellow-500
      case 'Dependiente': return '#3b82f6'; // blue-500
      case 'Autónoma': return '#22c55e'; // green-500
      default: return '#6b7280'; // gray-500
    }
  };

  const getDomains = (zone: string, maxVal: number, avgX: number, avgY: number) => {
    const pad = maxVal * 0.05; // 5% padding
    const zoomFactor = 1 / zoomLevel;
    
    let xDomain = [0, maxVal];
    let yDomain = [0, maxVal];

    switch (zone) {
      case 'conflict': 
        xDomain = [Math.max(0, avgX - pad), maxVal];
        yDomain = [Math.max(0, avgY - pad), maxVal];
        break;
      case 'power': 
        xDomain = [0, avgX + pad];
        yDomain = [Math.max(0, avgY - pad), maxVal];
        break;
      case 'false_problem': 
        xDomain = [0, avgX + pad];
        yDomain = [0, avgY + pad];
        break;
      case 'exit': 
        xDomain = [Math.max(0, avgX - pad), maxVal];
        yDomain = [0, avgY + pad];
        break;
      default: 
        xDomain = [0, maxVal];
        yDomain = [0, maxVal];
        break;
    }

    if (zoomLevel > 1) {
      const xCenter = (xDomain[0] + xDomain[1]) / 2;
      const yCenter = (yDomain[0] + yDomain[1]) / 2;
      const xRange = (xDomain[1] - xDomain[0]) * zoomFactor;
      const yRange = (yDomain[1] - yDomain[0]) * zoomFactor;
      xDomain = [Math.max(0, xCenter - xRange / 2), xCenter + xRange / 2];
      yDomain = [Math.max(0, yCenter - yRange / 2), yCenter + yRange / 2];
    }

    return { x: xDomain, y: yDomain };
  };

  const addManualVar = () => {
    setManualVars([...manualVars, { id: `V${manualVars.length + 1}`, longName: '', shortName: '', description: '' }]);
  };

  const removeManualVar = (index: number) => {
    if (manualVars.length <= 2) return;
    const newVars = [...manualVars];
    newVars.splice(index, 1);
    newVars.forEach((v, i) => v.id = `V${i + 1}`);
    setManualVars(newVars);
  };

  const handleManualVarChange = (index: number, field: keyof typeof manualVars[0], value: string) => {
    const newVars = [...manualVars];
    newVars[index][field] = value;
    setManualVars(newVars);
  };

  const goToMatrix = () => {
    const size = manualVars.length;
    const newMatrix = Array(size).fill(0).map(() => Array(size).fill(0));
    setManualMatrix(newMatrix);
    setManualStep(2);
  };

  const handleMatrixChange = (r: number, c: number, value: string) => {
    const num = parseInt(value, 10) || 0;
    const newMatrix = [...manualMatrix];
    newMatrix[r] = [...newMatrix[r]];
    newMatrix[r][c] = num;
    setManualMatrix(newMatrix);
  };

  const analyzeManualData = () => {
    const variables = manualVars.map(v => v.shortName || v.longName || v.id);
    const data: MatrixData = { variables, matrix: manualMatrix };
    
    if (scale === 'auto') {
      let maxVal = 0;
      data.matrix.forEach(row => row.forEach(val => { if (val > maxVal) maxVal = val; }));
      setScale(`0-${maxVal}`);
    }

    setMatrixData(data);
    const analysis = analyzeMatrix(data, iterations);
    setResult(analysis);
    setManualMode(false);
    setActiveTab('resumen');
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">MACTDEMAT</h1>
          </div>
          <div className="text-sm text-gray-500 font-medium">Análisis Estructural Avanzado</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!result ? (
          manualMode ? (
            <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold">Ingreso Manual de Datos</h2>
                <button onClick={() => setManualMode(false)} className="text-gray-500 hover:text-gray-700">Cancelar</button>
              </div>
              
              {manualStep === 1 ? (
                <div className="space-y-4">
                  <p className="text-gray-600">Define las variables de tu sistema. Puedes añadir o eliminar variables según necesites.</p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre Corto</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre Largo</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {manualVars.map((v, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{v.id}</td>
                            <td className="px-4 py-2">
                              <input type="text" value={v.shortName} onChange={(e) => handleManualVarChange(i, 'shortName', e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-1.5 border" placeholder="Ej. INV" />
                            </td>
                            <td className="px-4 py-2">
                              <input type="text" value={v.longName} onChange={(e) => handleManualVarChange(i, 'longName', e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-1.5 border" placeholder="Ej. Inversión" />
                            </td>
                            <td className="px-4 py-2">
                              <input type="text" value={v.description} onChange={(e) => handleManualVarChange(i, 'description', e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-1.5 border" placeholder="Descripción..." />
                            </td>
                            <td className="px-4 py-2">
                              <button onClick={() => removeManualVar(i)} disabled={manualVars.length <= 2} className="text-red-600 hover:text-red-800 disabled:opacity-50 text-sm">Eliminar</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-between items-center mt-4">
                    <button onClick={addManualVar} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                      + Añadir Variable
                    </button>
                    <button onClick={goToMatrix} className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
                      Siguiente: Llenar Matriz
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-600">Ingresa los valores de influencia directa. La diagonal (influencia sobre sí misma) será 0.</p>
                  <div className="overflow-x-auto">
                    <table className="min-w-max divide-y divide-gray-200 border border-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 border-r border-gray-200"></th>
                          {manualVars.map((v) => (
                            <th key={v.id} className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase border-b border-gray-200" title={v.longName || v.shortName}>
                              {v.shortName || v.id}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {manualVars.map((rowVar, r) => (
                          <tr key={`row-${r}`}>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase bg-gray-50 border-r border-gray-200" title={rowVar.longName || rowVar.shortName}>
                              {rowVar.shortName || rowVar.id}
                            </th>
                            {manualVars.map((colVar, c) => (
                              <td key={`cell-${r}-${c}`} className="p-0 border-r border-gray-200 last:border-r-0">
                                <input 
                                  type="number" 
                                  min="0" 
                                  max="10"
                                  value={manualMatrix[r]?.[c] || ''} 
                                  onChange={(e) => handleMatrixChange(r, c, e.target.value)}
                                  disabled={r === c}
                                  className="w-16 h-10 text-center border-none focus:ring-2 focus:ring-inset focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-between items-center mt-4">
                    <button onClick={() => setManualStep(1)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                      Atrás
                    </button>
                    <button onClick={analyzeManualData} className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
                      Analizar Matriz
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">Sube tu Matriz de Análisis</h2>
                  <p className="text-gray-500 mb-8 max-w-md mx-auto">
                    Carga un archivo Excel (.xls, .xlsx) o CSV con tu matriz de influencias. El sistema detectará automáticamente las variables y la estructura.
                  </p>
                  
                  <div className="relative">
                    <input 
                      type="file" 
                      accept=".xlsx, .xls, .csv" 
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={loading}
                    />
                    <div className={cn(
                      "border-2 border-dashed rounded-lg p-8 transition-colors",
                      loading ? "border-gray-300 bg-gray-50" : "border-blue-300 bg-blue-50 hover:bg-blue-100"
                    )}>
                      {loading ? (
                        <div className="flex flex-col items-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                          <span className="text-blue-600 font-medium">Procesando matriz...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-blue-600">
                          <FileSpreadsheet className="w-8 h-8 mb-2" />
                          <span className="font-medium">Haz clic para seleccionar o arrastra un archivo aquí</span>
                          <span className="text-sm text-blue-400 mt-1">Soporta .xlsx, .xls, .csv</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-8 flex items-center justify-center gap-4">
                    <div className="h-px bg-gray-200 flex-1"></div>
                    <span className="text-gray-500 font-medium text-sm uppercase">O</span>
                    <div className="h-px bg-gray-200 flex-1"></div>
                  </div>
                  
                  <button 
                    onClick={() => setManualMode(true)}
                    className="mt-8 w-full py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Table className="w-5 h-5" />
                    Ingresar variables manualmente
                  </button>

                  {error && (
                    <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-start gap-3 text-left">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Error al procesar</h4>
                        <p className="text-sm mt-1">{error}</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="bg-gray-50 p-6 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Configuración Inicial
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Escala de Influencia</label>
                      <select 
                        value={scale} 
                        onChange={(e) => setScale(e.target.value)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border bg-white"
                      >
                        <option value="auto">Detectar automáticamente</option>
                        <option value="0-3">0 a 3 (Nula, Débil, Media, Fuerte)</option>
                        <option value="0-5">0 a 5 (Extendida)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Iteraciones (MII)</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="10" 
                        value={iterations} 
                        onChange={(e) => setIterations(Number(e.target.value))}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border bg-white"
                      />
                      <p className="text-xs text-gray-500 mt-1">Para el cálculo de influencias indirectas.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-6">
            {/* Results Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Resultados del Análisis</h2>
                <p className="text-gray-500">Matriz de {result.variables.length} x {result.variables.length} variables procesada exitosamente.</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => { setResult(null); setFile(null); }}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
                >
                  Cargar otra matriz
                </button>
                <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-md px-3 py-1.5 shadow-sm">
                  <label className="text-sm text-gray-600">Iteraciones:</label>
                  <input 
                    type="number" 
                    min="1" max="10" 
                    value={iterations} 
                    onChange={(e) => setIterations(Number(e.target.value))}
                    className="w-12 text-sm border-none p-0 focus:ring-0 text-center bg-gray-50 rounded"
                  />
                  <button 
                    onClick={handleReanalyze}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium ml-2"
                  >
                    Recalcular
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8 overflow-x-auto">
                {[
                  { id: 'resumen', name: 'Resumen', icon: Info },
                  { id: 'mid', name: 'Matriz Directa (MID)', icon: Table },
                  { id: 'mii', name: 'Matriz Indirecta (MII)', icon: Table },
                  { id: 'grafico', name: 'Plano Cartesiano', icon: BarChart2 },
                  { id: 'pro', name: 'Análisis Pro', icon: Star },
                  { id: 'interpretacion', name: 'Interpretación', icon: FileSpreadsheet },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2",
                      activeTab === tab.id
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    )}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.name}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[500px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Resumen Tab */}
                  {activeTab === 'resumen' && (
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Indicadores por Variable</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variable</th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Motricidad</th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Dependencia</th>
                          <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Cuadrante</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {result.indicators.map((ind) => (
                          <tr key={ind.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ind.id}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ind.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-mono">{ind.motricity}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-mono">{ind.dependence}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style={{
                                backgroundColor: `${getQuadrantColor(ind.quadrant)}20`,
                                color: getQuadrantColor(ind.quadrant)
                              }}>
                                {ind.quadrant}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* MID Tab */}
              {activeTab === 'mid' && (
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Matriz de Influencias Directas (MID)</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 border-r border-gray-200 text-xs font-medium text-gray-500 bg-gray-100 sticky left-0 z-10">MID</th>
                          {result.variables.map((v, i) => (
                            <th key={i} className="px-4 py-2 text-center text-xs font-medium text-gray-500 border-r border-gray-200" title={v}>
                              V{i+1}
                            </th>
                          ))}
                          <th className="px-4 py-2 text-center text-xs font-bold text-gray-900 bg-blue-50">Suma (M)</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {result.mid.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <th className="px-4 py-2 border-r border-gray-200 text-xs font-medium text-gray-900 bg-gray-50 sticky left-0 z-10 text-left" title={result.variables[i]}>
                              V{i+1}
                            </th>
                            {row.map((val, j) => (
                              <td key={j} className={cn(
                                "px-4 py-2 text-center text-sm font-mono border-r border-gray-200",
                                i === j ? "bg-gray-100 text-gray-400" : "text-gray-900"
                              )}>
                                {val}
                              </td>
                            ))}
                            <td className="px-4 py-2 text-center text-sm font-bold font-mono bg-blue-50 text-blue-900">
                              {result.indicators[i].motricity}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-blue-50">
                          <th className="px-4 py-2 border-r border-gray-200 text-xs font-bold text-gray-900 sticky left-0 z-10 text-left">
                            Suma (D)
                          </th>
                          {result.indicators.map((ind, i) => (
                            <td key={i} className="px-4 py-2 text-center text-sm font-bold font-mono border-r border-gray-200 text-blue-900">
                              {ind.dependence}
                            </td>
                          ))}
                          <td className="px-4 py-2 bg-blue-100"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* MII Tab */}
              {activeTab === 'mii' && (
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Matriz de Influencias Indirectas (MII) - {iterations} Iteraciones</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 border-r border-gray-200 text-xs font-medium text-gray-500 bg-gray-100 sticky left-0 z-10">MII</th>
                          {result.variables.map((v, i) => (
                            <th key={i} className="px-4 py-2 text-center text-xs font-medium text-gray-500 border-r border-gray-200" title={v}>
                              V{i+1}
                            </th>
                          ))}
                          <th className="px-4 py-2 text-center text-xs font-bold text-gray-900 bg-blue-50">Suma (M)</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {result.mii.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <th className="px-4 py-2 border-r border-gray-200 text-xs font-medium text-gray-900 bg-gray-50 sticky left-0 z-10 text-left" title={result.variables[i]}>
                              V{i+1}
                            </th>
                            {row.map((val, j) => (
                              <td key={j} className={cn(
                                "px-4 py-2 text-center text-sm font-mono border-r border-gray-200",
                                i === j ? "bg-gray-100 text-gray-400" : "text-gray-900"
                              )}>
                                {val}
                              </td>
                            ))}
                            <td className="px-4 py-2 text-center text-sm font-bold font-mono bg-blue-50 text-blue-900">
                              {result.indicators[i].indirectMotricity}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-blue-50">
                          <th className="px-4 py-2 border-r border-gray-200 text-xs font-bold text-gray-900 sticky left-0 z-10 text-left">
                            Suma (D)
                          </th>
                          {result.indicators.map((ind, i) => (
                            <td key={i} className="px-4 py-2 text-center text-sm font-bold font-mono border-r border-gray-200 text-blue-900">
                              {ind.indirectDependence}
                            </td>
                          ))}
                          <td className="px-4 py-2 bg-blue-100"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Gráfico Tab */}
              {activeTab === 'grafico' && (() => {
                const maxMotricity = Math.max(...result.indicators.map(i => i.motricity));
                const maxDependence = Math.max(...result.indicators.map(i => i.dependence));
                const maxVal = Math.ceil(Math.max(maxMotricity, maxDependence) * 1.1);
                const domains = getDomains(focusZone, maxVal, result.avgDependence, result.avgMotricity);

                return (
                  <div className="p-6 flex flex-col h-[750px]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                      <div>
                        <h3 className="text-lg font-semibold mb-1">Plano Cartesiano (Influencias Directas)</h3>
                        <p className="text-sm text-gray-500">Clasificación inicial basada en la Matriz de Influencias Directas (MID).</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 shadow-sm">
                          <Target className="w-4 h-4 text-gray-500" />
                          <label className="text-sm font-medium text-gray-700">Enfocar zona:</label>
                          <select 
                            value={focusZone} 
                            onChange={(e) => { setFocusZone(e.target.value); setZoomLevel(1); }}
                            className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-1 bg-white"
                          >
                            <option value="all">Todo el plano</option>
                            <option value="conflict">Zona de Conflicto (Clave)</option>
                            <option value="power">Zona de Poder (Motora)</option>
                            <option value="false_problem">Falso Problema (Autónoma)</option>
                            <option value="exit">Zona de Salida (Dependiente)</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 shadow-sm">
                          <ZoomIn className="w-4 h-4 text-gray-500" />
                          <label className="text-sm font-medium text-gray-700">Zoom:</label>
                          <input 
                            type="range" 
                            min="1" 
                            max="5" 
                            step="0.1"
                            value={zoomLevel} 
                            onChange={(e) => setZoomLevel(Number(e.target.value))}
                            className="w-24"
                          />
                          <span className="text-xs text-gray-500 font-mono w-8">{zoomLevel.toFixed(1)}x</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-1 w-full relative bg-gray-50/50 rounded-xl border border-gray-100 overflow-hidden flex items-center justify-center p-4">
                      <div className="w-full h-full max-w-[650px] max-h-[650px] aspect-square bg-white shadow-sm rounded-lg border border-gray-200 relative">
                        <div className="absolute top-6 left-6 text-xs font-bold text-red-500/40 uppercase tracking-widest z-0 pointer-events-none">Zona de Poder</div>
                        <div className="absolute top-6 right-6 text-xs font-bold text-yellow-500/40 uppercase tracking-widest z-0 text-right pointer-events-none">Zona de Conflicto</div>
                        <div className="absolute bottom-12 left-6 text-xs font-bold text-green-500/40 uppercase tracking-widest z-0 pointer-events-none">Falso Problema</div>
                        <div className="absolute bottom-12 right-6 text-xs font-bold text-blue-500/40 uppercase tracking-widest z-0 text-right pointer-events-none">Zona de Salida</div>

                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 30, right: 30, bottom: 30, left: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                            <XAxis 
                              type="number" 
                              dataKey="dependence" 
                              name="Dependencia" 
                              label={{ value: 'Dependencia (X)', position: 'bottom', offset: 0, style: { fontSize: 12, fontWeight: 500 } }}
                              domain={domains.x} 
                              tick={{ fontSize: 12 }} 
                              allowDataOverflow
                            />
                            <YAxis 
                              type="number" 
                              dataKey="motricity" 
                              name="Motricidad" 
                              label={{ value: 'Motricidad (Y)', angle: -90, position: 'left', style: { fontSize: 12, fontWeight: 500 } }}
                              domain={domains.y} 
                              tick={{ fontSize: 12 }} 
                              allowDataOverflow
                            />
                            <Tooltip 
                              cursor={{ strokeDasharray: '3 3' }}
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg z-50">
                                      <p className="font-bold text-sm">{data.name}</p>
                                      <p className="text-xs text-gray-500 mb-2">ID: {data.id}</p>
                                      <p className="text-sm text-gray-600">Motricidad: <span className="font-mono font-medium">{data.motricity.toFixed(2)}</span></p>
                                      <p className="text-sm text-gray-600">Dependencia: <span className="font-mono font-medium">{data.dependence.toFixed(2)}</span></p>
                                      <p className="text-sm font-medium mt-2" style={{ color: getQuadrantColor(data.quadrantDirect) }}>
                                        {data.quadrantDirect}
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <ReferenceLine x={result.avgDependence} stroke="#9ca3af" strokeDasharray="5 5" />
                            <ReferenceLine y={result.avgMotricity} stroke="#9ca3af" strokeDasharray="5 5" />
                            <Scatter name="Variables" data={result.indicators} fill="#8884d8">
                              {result.indicators.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getQuadrantColor(entry.quadrantDirect)} />
                              ))}
                              <LabelList dataKey="name" position="top" offset={8} style={{ fontSize: '11px', fontWeight: '600', fill: '#374151', textShadow: '1px 1px 2px white' }} />
                            </Scatter>
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Análisis Pro Tab */}
              {activeTab === 'pro' && (() => {
                // We use the normalized indirect values for the Pro analysis
                // to allow comparison and proper diagonal projection.
                const maxMotricity = Math.max(...result.indicators.map(i => i.normIndirectMotricity));
                const maxDependence = Math.max(...result.indicators.map(i => i.normIndirectDependence));
                const maxVal = Math.ceil(Math.max(maxMotricity, maxDependence) * 1.1);
                const domains = getDomains(focusZone, maxVal, result.normAvg, result.normAvg);

                // Calculate orthogonal distance to the diagonal (y = x)
                const indicatorsWithDist = result.indicators.map(ind => {
                  const px = (ind.normIndirectDependence + ind.normIndirectMotricity) / 2;
                  const py = (ind.normIndirectDependence + ind.normIndirectMotricity) / 2;
                  const dist = Math.sqrt(Math.pow(ind.normIndirectDependence - px, 2) + Math.pow(ind.normIndirectMotricity - py, 2));
                  return { ...ind, px, py, dist };
                });

                // Filter ONLY variables in the Conflict Zone (Clave)
                const conflictVars = indicatorsWithDist.filter(ind => ind.quadrantIndirect === 'Clave');

                // Get top N closest to the diagonal from the conflict zone
                const topNIndicators = [...conflictVars]
                  .sort((a, b) => a.dist - b.dist)
                  .slice(0, topN);

                return (
                  <div className="p-6 flex flex-col min-h-[750px]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                      <div>
                        <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                          <Star className="w-5 h-5 text-yellow-500" />
                          Análisis Pro (Influencias Indirectas)
                        </h3>
                        <p className="text-sm text-gray-500">Clasificación estructural definitiva y análisis de la diagonal estratégica.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 shadow-sm">
                          <Target className="w-4 h-4 text-gray-500" />
                          <label className="text-sm font-medium text-gray-700">Enfocar zona:</label>
                          <select 
                            value={focusZone} 
                            onChange={(e) => { setFocusZone(e.target.value); setZoomLevel(1); }}
                            className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-1 bg-white"
                          >
                            <option value="all">Todo el plano</option>
                            <option value="conflict">Zona de Conflicto (Clave)</option>
                            <option value="power">Zona de Poder (Motora)</option>
                            <option value="false_problem">Falso Problema (Autónoma)</option>
                            <option value="exit">Zona de Salida (Dependiente)</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 shadow-sm">
                          <ZoomIn className="w-4 h-4 text-gray-500" />
                          <label className="text-sm font-medium text-gray-700">Zoom:</label>
                          <input 
                            type="range" 
                            min="1" 
                            max="5" 
                            step="0.1"
                            value={zoomLevel} 
                            onChange={(e) => setZoomLevel(Number(e.target.value))}
                            className="w-24"
                          />
                          <span className="text-xs text-gray-500 font-mono w-8">{zoomLevel.toFixed(1)}x</span>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 shadow-sm">
                          <label className="text-sm font-medium text-gray-700">Proyectar variables:</label>
                          <input 
                            type="number" 
                            min="0" 
                            max={conflictVars.length} 
                            value={topN} 
                            onChange={(e) => setTopN(Number(e.target.value))}
                            className="w-16 text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-1 text-center"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="w-full relative bg-gray-50/50 rounded-xl border border-gray-100 overflow-hidden flex items-center justify-center p-4 h-[700px]">
                      <div className="w-full h-full max-w-[650px] max-h-[650px] aspect-square bg-white shadow-sm rounded-lg border border-gray-200 relative">
                        <div className="absolute top-6 left-6 text-xs font-bold text-red-500/40 uppercase tracking-widest z-0 pointer-events-none">Zona de Poder</div>
                        <div className="absolute top-6 right-6 text-xs font-bold text-yellow-500/40 uppercase tracking-widest z-0 text-right pointer-events-none">Zona de Conflicto</div>
                        <div className="absolute bottom-12 left-6 text-xs font-bold text-green-500/40 uppercase tracking-widest z-0 pointer-events-none">Falso Problema</div>
                        <div className="absolute bottom-12 right-6 text-xs font-bold text-blue-500/40 uppercase tracking-widest z-0 text-right pointer-events-none">Zona de Salida</div>

                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 30, right: 30, bottom: 30, left: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                            <XAxis 
                              type="number" 
                              dataKey="normIndirectDependence" 
                              name="Dependencia" 
                              label={{ value: 'Dependencia Indirecta (X)', position: 'bottom', offset: 0, style: { fontSize: 12, fontWeight: 500 } }}
                              domain={domains.x} 
                              tick={{ fontSize: 12 }} 
                              allowDataOverflow
                            />
                            <YAxis 
                              type="number" 
                              dataKey="normIndirectMotricity" 
                              name="Motricidad" 
                              label={{ value: 'Motricidad Indirecta (Y)', angle: -90, position: 'left', style: { fontSize: 12, fontWeight: 500 } }}
                              domain={domains.y} 
                              tick={{ fontSize: 12 }} 
                              allowDataOverflow
                            />
                            <Tooltip 
                              cursor={{ strokeDasharray: '3 3' }}
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg z-50">
                                      <p className="font-bold text-sm">{data.name}</p>
                                      <p className="text-xs text-gray-500 mb-2">ID: {data.id}</p>
                                      <p className="text-sm text-gray-600">Motricidad (Norm): <span className="font-mono font-medium">{data.normIndirectMotricity.toFixed(2)}%</span></p>
                                      <p className="text-sm text-gray-600">Dependencia (Norm): <span className="font-mono font-medium">{data.normIndirectDependence.toFixed(2)}%</span></p>
                                      <p className="text-sm font-medium mt-2" style={{ color: getQuadrantColor(data.quadrantIndirect) }}>
                                        {data.quadrantIndirect}
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            
                            <ReferenceLine x={result.normAvg} stroke="#9ca3af" strokeDasharray="5 5" />
                            <ReferenceLine y={result.normAvg} stroke="#9ca3af" strokeDasharray="5 5" />
                            
                            {/* Strategic Diagonal (Red Line) */}
                            {(() => {
                              const start = Math.max(domains.x[0], domains.y[0]);
                              const end = Math.min(domains.x[1], domains.y[1]);
                              if (start <= end) {
                                return <ReferenceLine segment={[{x: start, y: start}, {x: end, y: end}]} stroke="#ef4444" strokeWidth={2} opacity={0.6} />;
                              }
                              return null;
                            })()}
                            
                            {/* Projections (Green Lines) - Solid lines for conflict zone only */}
                            {topNIndicators.map(ind => (
                              <ReferenceLine 
                                key={`proj-${ind.id}`} 
                                segment={[{x: ind.normIndirectDependence, y: ind.normIndirectMotricity}, {x: ind.px, y: ind.py}]} 
                                stroke="#22c55e" 
                                strokeWidth={2}
                                opacity={0.8}
                              />
                            ))}

                            <Scatter name="Variables" data={indicatorsWithDist} fill="#8884d8">
                              {indicatorsWithDist.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getQuadrantColor(entry.quadrantIndirect)} />
                              ))}
                              <LabelList dataKey="name" position="top" offset={8} style={{ fontSize: '11px', fontWeight: '600', fill: '#374151', textShadow: '1px 1px 2px white' }} />
                            </Scatter>
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Table for Conflict Zone Variables */}
                    {topNIndicators.length > 0 && (
                      <div className="mt-8 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                          <h4 className="font-semibold text-gray-800">Variables en la Zona de Conflicto</h4>
                          <p className="text-sm text-gray-500">Estas son las {topNIndicators.length} variables más cercanas a la diagonal estratégica dentro de la zona de conflicto (marcadas con línea verde).</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variable</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Motricidad</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dependencia</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Distancia a Diagonal</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {topNIndicators.map((ind) => (
                                <tr key={ind.id} className="hover:bg-green-50/50">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ind.id}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ind.name}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{ind.normIndirectMotricity.toFixed(2)}%</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{ind.normIndirectDependence.toFixed(2)}%</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-mono font-medium">{ind.dist.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Interpretación Tab */}
              {activeTab === 'interpretacion' && (
                <div className="p-8 max-w-4xl">
                  <div className="prose prose-blue max-w-none">
                    <div className="markdown-body">
                      <ReactMarkdown>{generateInterpretation()}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

