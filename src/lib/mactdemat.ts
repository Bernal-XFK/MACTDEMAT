import * as XLSX from 'xlsx';

export interface MatrixData {
  variables: string[];
  matrix: number[][];
}

export interface VariableIndicator {
  id: string;
  name: string;
  motricity: number;
  dependence: number;
  indirectMotricity: number;
  indirectDependence: number;
  normDirectMotricity: number;
  normDirectDependence: number;
  normIndirectMotricity: number;
  normIndirectDependence: number;
  quadrantDirect: string;
  quadrantIndirect: string;
  quadrant: string;
}

export interface AnalysisResult {
  variables: string[];
  mid: number[][];
  mii: number[][];
  indicators: VariableIndicator[];
  avgMotricity: number;
  avgDependence: number;
  avgIndirectMotricity: number;
  avgIndirectDependence: number;
  normAvg: number;
}

export async function parseExcel(file: File): Promise<MatrixData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        const result = extractMatrix(json);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function extractMatrix(data: any[][]): MatrixData {
  let startRow = -1;
  let startCol = -1;
  let maxNumCount = 0;

  // Find the largest block of numbers
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;
    
    let numCount = 0;
    let firstNumCol = -1;
    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      if (typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '')) {
        numCount++;
        if (firstNumCol === -1) firstNumCol = c;
      }
    }
    
    if (numCount > maxNumCount && numCount > 1) {
      maxNumCount = numCount;
      startRow = r;
      startCol = firstNumCol;
    }
  }

  if (startRow === -1 || startCol === -1) {
    throw new Error("No se pudo detectar una matriz numérica en el archivo.");
  }

  const size = maxNumCount;
  const matrix: number[][] = [];
  const rowHeaders: string[] = [];
  const colHeaders: string[] = [];

  // Extract column headers
  if (startRow > 0) {
    for (let c = startCol; c < startCol + size; c++) {
      colHeaders.push(String(data[startRow - 1][c] || `V${c - startCol + 1}`).trim());
    }
  } else {
    for (let c = 0; c < size; c++) colHeaders.push(`V${c + 1}`);
  }

  // Extract row headers and matrix data
  for (let r = startRow; r < startRow + size; r++) {
    if (r >= data.length) break;
    const row = data[r];
    
    if (startCol > 0) {
      rowHeaders.push(String(row[startCol - 1] || `V${r - startRow + 1}`).trim());
    } else {
      rowHeaders.push(`V${r - startRow + 1}`);
    }

    const matrixRow: number[] = [];
    for (let c = startCol; c < startCol + size; c++) {
      let val = row[c];
      if (typeof val === 'string') val = Number(val);
      if (isNaN(val) || val === null || val === undefined) val = 0;
      matrixRow.push(val);
    }
    matrix.push(matrixRow);
  }

  // Use row headers if they look like valid names, else col headers
  const variables = rowHeaders.map((h, i) => {
    if (h && h !== `V${i+1}` && h !== 'undefined') return h;
    if (colHeaders[i] && colHeaders[i] !== `V${i+1}` && colHeaders[i] !== 'undefined') return colHeaders[i];
    return `V${i+1}`;
  });

  // Normalize diagonal to 0
  for (let i = 0; i < size; i++) {
    if (matrix[i] && matrix[i][i] !== undefined) {
      matrix[i][i] = 0;
    }
  }

  return { variables, matrix };
}

export function multiplyMatrices(a: number[][], b: number[][]): number[][] {
  const aNumRows = a.length, aNumCols = a[0].length,
        bNumRows = b.length, bNumCols = b[0].length,
        m = new Array(aNumRows);
  for (let r = 0; r < aNumRows; ++r) {
    m[r] = new Array(bNumCols);
    for (let c = 0; c < bNumCols; ++c) {
      m[r][c] = 0;
      for (let i = 0; i < aNumCols; ++i) {
        m[r][c] += a[r][i] * b[i][c];
      }
    }
  }
  return m;
}

export function matrixPower(matrix: number[][], power: number): number[][] {
  if (power <= 1) return matrix;
  let result = matrix;
  for (let i = 1; i < power; i++) {
    result = multiplyMatrices(result, matrix);
  }
  return result;
}

export function calculateIndicators(matrix: number[][]) {
  const motricity = matrix.map(row => row.reduce((sum, val) => sum + val, 0));
  const dependence = matrix[0].map((_, colIndex) => matrix.reduce((sum, row) => sum + row[colIndex], 0));
  return { motricity, dependence };
}

export function analyzeMatrix(data: MatrixData, iterations: number = 5): AnalysisResult {
  const { variables, matrix: mid } = data;
  
  // Calculate Direct Indicators
  const direct = calculateIndicators(mid);
  
  // Calculate Indirect Matrix (MII)
  const mii = matrixPower(mid, iterations);
  
  // Calculate Indirect Indicators
  const indirect = calculateIndicators(mii);

  const totalDirectMotricity = direct.motricity.reduce((a, b) => a + b, 0);
  const totalDirectDependence = direct.dependence.reduce((a, b) => a + b, 0);
  
  const totalIndirectMotricity = indirect.motricity.reduce((a, b) => a + b, 0);
  const totalIndirectDependence = indirect.dependence.reduce((a, b) => a + b, 0);

  const avgDirectMotricity = totalDirectMotricity / variables.length;
  const avgDirectDependence = totalDirectDependence / variables.length;
  
  const avgIndirectMotricity = totalIndirectMotricity / variables.length;
  const avgIndirectDependence = totalIndirectDependence / variables.length;

  const normAvg = 100 / variables.length;

  const indicators: VariableIndicator[] = variables.map((v, i) => {
    const m = direct.motricity[i];
    const d = direct.dependence[i];
    const im = indirect.motricity[i];
    const id = indirect.dependence[i];

    const ndm = totalDirectMotricity > 0 ? (m / totalDirectMotricity) * 100 : 0;
    const ndd = totalDirectDependence > 0 ? (d / totalDirectDependence) * 100 : 0;
    const nim = totalIndirectMotricity > 0 ? (im / totalIndirectMotricity) * 100 : 0;
    const nid = totalIndirectDependence > 0 ? (id / totalIndirectDependence) * 100 : 0;

    const getQuad = (mot: number, dep: number, avgMot: number, avgDep: number) => {
      if (mot >= avgMot && dep < avgDep) return 'Motora';
      if (mot >= avgMot && dep >= avgDep) return 'Clave';
      if (mot < avgMot && dep < avgDep) return 'Autónoma';
      return 'Dependiente';
    };

    return {
      id: `V${i+1}`,
      name: v,
      motricity: m,
      dependence: d,
      indirectMotricity: im,
      indirectDependence: id,
      normDirectMotricity: ndm,
      normDirectDependence: ndd,
      normIndirectMotricity: nim,
      normIndirectDependence: nid,
      quadrantDirect: getQuad(m, d, avgDirectMotricity, avgDirectDependence),
      quadrantIndirect: getQuad(im, id, avgIndirectMotricity, avgIndirectDependence),
      quadrant: getQuad(im, id, avgIndirectMotricity, avgIndirectDependence) // MICMAC uses indirect for final classification
    };
  });

  return {
    variables,
    mid,
    mii,
    indicators,
    avgMotricity: avgDirectMotricity,
    avgDependence: avgDirectDependence,
    avgIndirectMotricity,
    avgIndirectDependence,
    normAvg
  };
}

export function generateInterpretation(result: AnalysisResult): string {
  const { indicators } = result;
  
  const motoras = indicators.filter(i => i.quadrant === 'Motora');
  const claves = indicators.filter(i => i.quadrant === 'Clave');
  const dependientes = indicators.filter(i => i.quadrant === 'Dependiente');
  const autonomas = indicators.filter(i => i.quadrant === 'Autónoma');

  let interpretation = "### Análisis Estructural MACTDEMAT\n\n";
  
  interpretation += "**1. Variables Clave (Alta Motricidad, Alta Dependencia)**\n";
  if (claves.length > 0) {
    interpretation += `Se identificaron ${claves.length} variables clave: ${claves.map(v => v.name).join(', ')}. Estas variables son muy inestables; cualquier acción sobre ellas tendrá repercusiones en todo el sistema y, a su vez, serán fuertemente impactadas por cambios en otras variables. Son los puntos críticos de intervención estratégica.\n\n`;
  } else {
    interpretation += "No se identificaron variables clave en el sistema actual.\n\n";
  }

  interpretation += "**2. Variables Motoras / Determinantes (Alta Motricidad, Baja Dependencia)**\n";
  if (motoras.length > 0) {
    interpretation += `Existen ${motoras.length} variables motoras: ${motoras.map(v => v.name).join(', ')}. Estas son las variables explicativas del sistema. Son muy influyentes y poco dependientes, lo que significa que actúan como frenos o motores del sistema. Las acciones estratégicas deben enfocarse aquí para generar cambios estructurales.\n\n`;
  } else {
    interpretation += "No se identificaron variables motoras fuertes.\n\n";
  }

  interpretation += "**3. Variables Dependientes / Resultado (Baja Motricidad, Alta Dependencia)**\n";
  if (dependientes.length > 0) {
    interpretation += `Se encontraron ${dependientes.length} variables dependientes: ${dependientes.map(v => v.name).join(', ')}. Estas variables son el resultado del funcionamiento del sistema. Son muy sensibles a la evolución de las variables motoras y clave. No se deben atacar directamente, sino a través de las variables que las influyen.\n\n`;
  } else {
    interpretation += "No se identificaron variables puramente dependientes.\n\n";
  }

  interpretation += "**4. Variables Autónomas (Baja Motricidad, Baja Dependencia)**\n";
  if (autonomas.length > 0) {
    interpretation += `Hay ${autonomas.length} variables autónomas: ${autonomas.map(v => v.name).join(', ')}. Estas variables están relativamente desconectadas del sistema. Tienen poco potencial para generar cambios y son poco afectadas por el resto. Suelen ser tendencias pasadas o factores externos con impacto marginal.\n\n`;
  } else {
    interpretation += "No se identificaron variables autónomas.\n\n";
  }

  interpretation += "### Recomendaciones Accionables\n";
  if (motoras.length > 0) {
    interpretation += `- **Foco de Acción:** Priorizar políticas y recursos sobre las variables motoras (${motoras[0].name}${motoras.length > 1 ? '...' : ''}), ya que controlan la dinámica del sistema.\n`;
  }
  if (claves.length > 0) {
    interpretation += `- **Gestión de Riesgos:** Monitorear de cerca las variables clave (${claves[0].name}${claves.length > 1 ? '...' : ''}) debido a su alta inestabilidad. Intervenciones aquí deben ser cuidadosamente planeadas.\n`;
  }
  if (dependientes.length > 0) {
    interpretation += `- **Indicadores de Éxito:** Utilizar las variables dependientes (${dependientes[0].name}${dependientes.length > 1 ? '...' : ''}) como KPIs para medir el impacto de las acciones tomadas en las variables motoras.\n`;
  }

  return interpretation;
}
