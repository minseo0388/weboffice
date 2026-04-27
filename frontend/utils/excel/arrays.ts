import { ExcelFunction } from './types';

export const arrayFunctions: Record<string, ExcelFunction> = {
  UNIQUE: (args) => Array.from(new Set(args)).join(', '),
  SORT: (args) => [...args].sort().join(', '),
  SORTBY: (args, rawArgs, ctx) => {
      const arr1 = ctx.getRangeValues(rawArgs[0]);
      const arr2 = ctx.getRangeValues(rawArgs[1]);
      const pairs = arr1.map((v, i) => ({v, sortBy: arr2[i]}));
      pairs.sort((a, b) => a.sortBy < b.sortBy ? -1 : 1);
      return pairs.map(p => p.v).join(', ');
  },
  FILTER: (args, rawArgs, ctx) => {
      const arr = ctx.getRangeValues(rawArgs[0]);
      const include = ctx.getRangeValues(rawArgs[1]);
      return arr.filter((v, i) => Boolean(include[i])).join(', ');
  },
  SEQUENCE: (args) => {
      const rows = Number(args[0]) || 1;
      const cols = Number(args[1]) || 1;
      const start = Number(args[2]) || 1;
      const step = Number(args[3]) || 1;
      const res = [];
      let current = start;
      for (let i = 0; i < rows * cols; i++) {
          res.push(current);
          current += step;
      }
      return res.join(', ');
  },
  RANDARRAY: (args) => {
      const rows = Number(args[0]) || 1;
      const cols = Number(args[1]) || 1;
      const res = [];
      for (let i = 0; i < rows * cols; i++) res.push(Math.random());
      return res.join(', ');
  },
  SINGLE: (args) => args[0],
  VSTACK: (args, rawArgs, ctx) => {
      let res: any[] = [];
      rawArgs.forEach(r => res.push(...ctx.getRangeValues(r)));
      return res.join(', ');
  },
  HSTACK: (args, rawArgs, ctx) => ctx.callFunction("VSTACK", args, rawArgs),
  TOCOL: (args, rawArgs, ctx) => ctx.getRangeValues(rawArgs[0]).join(', '),
  TOROW: (args, rawArgs, ctx) => ctx.getRangeValues(rawArgs[0]).join(', '),
  CHOOSECOLS: (args, rawArgs, ctx) => ctx.getRangeValues(rawArgs[0]).join(', '),
  CHOOSEROWS: (args, rawArgs, ctx) => ctx.getRangeValues(rawArgs[0]).join(', '),
  TAKE: (args, rawArgs, ctx) => {
      const arr = ctx.getRangeValues(rawArgs[0]);
      const count = Number(args[1]);
      return (count > 0 ? arr.slice(0, count) : arr.slice(count)).join(', ');
  },
  DROP: (args, rawArgs, ctx) => {
      const arr = ctx.getRangeValues(rawArgs[0]);
      const count = Number(args[1]);
      return (count > 0 ? arr.slice(count) : arr.slice(0, count)).join(', ');
  },
  EXPAND: () => "Expand Placeholder",
  LET: () => "LET Placeholder",
  LAMBDA: () => "LAMBDA Placeholder",
  MAP: () => "MAP Placeholder",
  REDUCE: () => "REDUCE Placeholder",
  SCAN: () => "SCAN Placeholder",
};