export type CellData = { value: string | number | boolean; type: string };
export type GridData = CellData[][];

export type FunctionContext = {
  grid: GridData;
  getCellValue: (r: number, c: number) => any;
  getRangeValues: (rangeStr: string) => any[];
  getRange2D: (rangeStr: string) => any[][];
  parseCellRef: (ref: string) => { row: number; col: number } | null;
  checkCondition: (val: any, cond: any) => boolean;
  evaluateFormula: (formula: string, grid: GridData) => string | number | boolean;
  callFunction: (name: string, args: any[], rawArgs: string[]) => any;
};

export type ExcelFunction = (args: any[], rawArgs: string[], ctx: FunctionContext) => any;