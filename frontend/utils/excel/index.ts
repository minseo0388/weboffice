import { GridData, FunctionContext } from './types';
import { mathFunctions } from './math';
import { textFunctions } from './text';
import { logicalFunctions } from './logical';
import { dateFunctions } from './date';
import { lookupFunctions } from './lookup';
import { statisticalFunctions } from './statistical';
import { financialFunctions } from './financial';
import { engineeringFunctions } from './engineering';
import { arrayFunctions } from './arrays';
import { databaseFunctions } from './database';
import { webFunctions } from './web';

const allFunctions = {
  ...mathFunctions,
  ...textFunctions,
  ...logicalFunctions,
  ...dateFunctions,
  ...lookupFunctions,
  ...statisticalFunctions,
  ...financialFunctions,
  ...engineeringFunctions,
  ...arrayFunctions,
  ...databaseFunctions,
  ...webFunctions,
};

export const parseCellRef = (ref: string): { row: number; col: number } | null => {
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  const colStr = match[1].toUpperCase();
  const rowStr = match[2];
  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64);
  }
  return { row: parseInt(rowStr, 10) - 1, col: col - 1 };
};

const checkCondition = (val: any, cond: any): boolean => {
  if (typeof cond === 'string') {
    const match = cond.match(/^(>=|<=|>|<|<>|=)?(.*)$/);
    if (match) {
      const op = match[1] || '=';
      const target = isNaN(Number(match[2])) ? match[2] : Number(match[2]);
      const v = typeof val === 'number' ? val : (isNaN(Number(val)) ? val : Number(val));
      switch(op) {
        case '>': return v > target;
        case '<': return v < target;
        case '>=': return v >= target;
        case '<=': return v <= target;
        case '<>': return v !== target;
        case '=': return String(v) === String(target);
      }
    }
  }
  return val === cond;
};

export const evaluateFormula = (formula: string, grid: GridData): string | number | boolean => {
  if (!formula.startsWith('=')) return formula;

  const getCellValue = (r: number, c: number): any => {
    const cell = grid[r]?.[c];
    if (!cell) return null;
    const val = cell.value;
    if (typeof val === 'string' && val.startsWith('=')) {
      return evaluateFormula(val, grid);
    }
    const num = Number(val);
    return isNaN(num) ? val : num;
  };

  const getRange2D = (rangeStr: string): any[][] => {
    const parts = rangeStr.split(':');
    if (parts.length !== 2) return [];
    const start = parseCellRef(parts[0]);
    const end = parseCellRef(parts[1]);
    if (!start || !end) return [];
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    const rows = [];
    for (let r = minRow; r <= maxRow; r++) {
      const row = [];
      for (let c = minCol; c <= maxCol; c++) {
        row.push(getCellValue(r, c));
      }
      rows.push(row);
    }
    return rows;
  };

  const getRangeValues = (rangeStr: string): any[] => getRange2D(rangeStr).flat();

  const resolveArgs = (args: string[]): any[] => {
    return args.flatMap(arg => {
      if (arg.includes(':')) return getRangeValues(arg);
      if (/^[A-Z]+\d+$/i.test(arg)) {
        const ref = parseCellRef(arg);
        if (ref) return [getCellValue(ref.row, ref.col)];
      }
      if (!isNaN(Number(arg))) return [Number(arg)];
      if (arg.startsWith('"') && arg.endsWith('"')) return [arg.slice(1, -1)];
      if (arg.toUpperCase() === 'TRUE') return [true];
      if (arg.toUpperCase() === 'FALSE') return [false];
      return [arg];
    });
  };

  const ctx: FunctionContext = {
    grid,
    getCellValue,
    getRange2D,
    getRangeValues,
    parseCellRef,
    checkCondition,
    evaluateFormula,
    callFunction: (name: string, args: any[], rawArgs: string[]) => {
      const fn = allFunctions[name as keyof typeof allFunctions];
      return fn ? fn(args, rawArgs, ctx) : '#NAME?';
    }
  };

  try {
    const expr = formula.substring(1).trim();
    const funcMatch = expr.match(/^([A-Z0-9_\.]+)\((.*)\)$/i);
    
    if (funcMatch) {
      const funcName = funcMatch[1].toUpperCase();
      const rawArgs = funcMatch[2].split(',').map(s => s.trim()).filter(s => s !== '');
      const func = allFunctions[funcName as keyof typeof allFunctions];
      if (func) {
        const resolvedArgs = resolveArgs(rawArgs);
        return func(resolvedArgs, rawArgs, ctx);
      }
      return '#NAME?';
    }

    let evalStr = expr;
    const cellRefs = expr.match(/[A-Z]+\d+/gi);
    if (cellRefs) {
      cellRefs.forEach(ref => {
        const parsed = parseCellRef(ref);
        if (parsed) {
          const val = getCellValue(parsed.row, parsed.col);
          evalStr = evalStr.replace(new RegExp(ref, 'gi'), String(val));
        }
      });
    }

    // eslint-disable-next-line no-new-func
    const result = new Function(`return ${evalStr}`)();
    return isNaN(result) ? result : Number(result);
  } catch (err) {
    return '#ERROR!';
  }
};