import { ExcelFunction } from './types';

export const lookupFunctions: Record<string, ExcelFunction> = {
  VLOOKUP: (args, rawArgs, ctx) => {
    const lookupValue = args[0];
    const tableArrayStr = rawArgs[1];
    const colIndexNum = Number(args[2]);
    const rangeLookup = args.length > 3 ? (args[3] !== false && String(args[3]).toUpperCase() !== 'FALSE') : true;
    
    if (colIndexNum < 1) return '#VALUE!';
    const table2D = ctx.getRange2D(tableArrayStr);
    if (!table2D || table2D.length === 0) return '#N/A';
    
    if (rangeLookup) {
        for (let i = table2D.length - 1; i >= 0; i--) {
           if (table2D[i][0] <= lookupValue) return table2D[i][colIndexNum - 1];
        }
    } else {
        for (let i = 0; i < table2D.length; i++) {
           if (table2D[i][0] == lookupValue) return table2D[i][colIndexNum - 1];
        }
    }
    return '#N/A';
  },
  HLOOKUP: (args, rawArgs, ctx) => {
    const lookupValue = args[0];
    const tableArrayStr = rawArgs[1];
    const rowIndexNum = Number(args[2]);
    const rangeLookup = args.length > 3 ? (args[3] !== false && String(args[3]).toUpperCase() !== 'FALSE') : true;
    
    if (rowIndexNum < 1) return '#VALUE!';
    const table2D = ctx.getRange2D(tableArrayStr);
    if (!table2D || table2D.length === 0) return '#N/A';
    
    const firstRow = table2D[0];
    for (let c = 0; c < firstRow.length; c++) {
       if (firstRow[c] == lookupValue) {
           if (table2D.length >= rowIndexNum) return table2D[rowIndexNum - 1][c];
           return '#REF!';
       }
    }
    return '#N/A';
  },
  INDEX: (args, rawArgs, ctx) => {
    const arrayStr = rawArgs[0];
    const rowNum = Number(args[1]);
    const colNum = args.length > 2 ? Number(args[2]) : 1;
    const table2D = ctx.getRange2D(arrayStr);
    if (!table2D || table2D.length === 0) return '#N/A';
    if (rowNum < 1 || rowNum > table2D.length || colNum < 1 || colNum > table2D[0].length) return '#REF!';
    return table2D[rowNum - 1][colNum - 1];
  },
  MATCH: (args, rawArgs, ctx) => {
    const lookupValue = args[0];
    const lookupArrayStr = rawArgs[1];
    const matchType = args.length > 2 ? Number(args[2]) : 1;
    const array = ctx.getRangeValues(lookupArrayStr);
    for (let i = 0; i < array.length; i++) {
        if (matchType === 0 && array[i] == lookupValue) return i + 1;
        if (matchType === 1 && array[i] <= lookupValue) return i + 1;
        if (matchType === -1 && array[i] >= lookupValue) return i + 1;
    }
    return '#N/A';
  },
  OFFSET: (args, rawArgs, ctx) => {
      const ref = ctx.parseCellRef(rawArgs[0]);
      if (!ref) return '#VALUE!';
      const rows = Number(args[1]);
      const cols = Number(args[2]);
      return ctx.getCellValue(ref.row + rows, ref.col + cols);
  },
  INDIRECT: (args, rawArgs, ctx) => {
      const refStr = String(args[0]);
      const ref = ctx.parseCellRef(refStr);
      if (!ref) return '#REF!';
      return ctx.getCellValue(ref.row, ref.col);
  },
  COLUMN: (args, rawArgs, ctx) => {
      if (!rawArgs || rawArgs.length === 0 || !rawArgs[0]) return '#VALUE!';
      const ref = ctx.parseCellRef(rawArgs[0]);
      return ref ? ref.col + 1 : '#VALUE!';
  },
  ROW: (args, rawArgs, ctx) => {
      if (!rawArgs || rawArgs.length === 0 || !rawArgs[0]) return '#VALUE!';
      const ref = ctx.parseCellRef(rawArgs[0]);
      return ref ? ref.row + 1 : '#VALUE!';
  },
  CHOOSE: (args) => {
      const indexNum = Math.floor(Number(args[0]));
      if (indexNum < 1 || indexNum >= args.length) return '#VALUE!';
      return args[indexNum];
  },
  XLOOKUP: (args, rawArgs, ctx) => {
      const lookupValue = args[0];
      const lookupArray = ctx.getRangeValues(rawArgs[1]);
      const returnArray = ctx.getRangeValues(rawArgs[2]);
      const notFound = args.length > 3 ? args[3] : '#N/A';
      for (let i = 0; i < lookupArray.length; i++) {
          if (lookupArray[i] == lookupValue) return returnArray[i] !== undefined ? returnArray[i] : notFound;
      }
      return notFound;
  },
};