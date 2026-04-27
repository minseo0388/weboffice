import { ExcelFunction } from './types';

export const logicalFunctions: Record<string, ExcelFunction> = {
  IF: (args) => (args[0] ? args[1] : args[2]),
  AND: (args) => args.every(a => Boolean(a)),
  OR: (args) => args.some(a => Boolean(a)),
  NOT: (args) => !args[0],
  IFERROR: (args) => {
      const val = args[0];
      if (String(val).startsWith('#')) return args[1];
      return val;
  },
  IFNA: (args) => {
      const val = args[0];
      if (val === '#N/A') return args[1];
      return val;
  },
  IFS: (args) => {
      for (let i = 0; i < args.length; i += 2) {
          if (args[i]) return args[i+1];
      }
      return '#N/A';
  },
  XOR: (args) => {
      const trueCount = args.filter(a => Boolean(a)).length;
      return trueCount % 2 === 1;
  },
  SUMIF: (args, rawArgs, ctx) => {
      const range = ctx.getRangeValues(rawArgs[0]);
      const criteria = args[1];
      const sumRange = args.length > 2 ? ctx.getRangeValues(rawArgs[2]) : range;
      let sum = 0;
      for (let i = 0; i < range.length; i++) {
          if (ctx.checkCondition(range[i], criteria)) sum += Number(sumRange[i]) || 0;
      }
      return sum;
  },
  SUMIFS: (args, rawArgs, ctx) => {
      const sumRange = ctx.getRangeValues(rawArgs[0]);
      let sum = 0;
      const criteriaSets = [];
      for (let i = 1; i < rawArgs.length; i += 2) {
          criteriaSets.push({ range: ctx.getRangeValues(rawArgs[i]), criteria: args[i+1] });
      }
      for (let i = 0; i < sumRange.length; i++) {
          const match = criteriaSets.every(cs => ctx.checkCondition(cs.range[i], cs.criteria));
          if (match) sum += Number(sumRange[i]) || 0;
      }
      return sum;
  },
  COUNTIF: (args, rawArgs, ctx) => {
      const range = ctx.getRangeValues(rawArgs[0]);
      const criteria = args[1];
      let count = 0;
      for (let i = 0; i < range.length; i++) {
          if (ctx.checkCondition(range[i], criteria)) count++;
      }
      return count;
  },
  COUNTIFS: (args, rawArgs, ctx) => {
      let count = 0;
      const firstRange = ctx.getRangeValues(rawArgs[0]);
      const criteriaSets = [];
      for (let i = 0; i < rawArgs.length; i += 2) {
          criteriaSets.push({ range: ctx.getRangeValues(rawArgs[i]), criteria: args[i+1] });
      }
      for (let i = 0; i < firstRange.length; i++) {
          const match = criteriaSets.every(cs => ctx.checkCondition(cs.range[i], cs.criteria));
          if (match) count++;
      }
      return count;
  },
  AVERAGEIF: (args, rawArgs, ctx) => {
      const range = ctx.getRangeValues(rawArgs[0]);
      const criteria = args[1];
      const avgRange = args.length > 2 ? ctx.getRangeValues(rawArgs[2]) : range;
      let sum = 0, count = 0;
      for (let i = 0; i < range.length; i++) {
          if (ctx.checkCondition(range[i], criteria)) {
              sum += Number(avgRange[i]) || 0;
              count++;
          }
      }
      return count > 0 ? sum / count : '#DIV/0!';
  },
  AVERAGEIFS: (args, rawArgs, ctx) => {
      const avgRange = ctx.getRangeValues(rawArgs[0]);
      let sum = 0, count = 0;
      const criteriaSets = [];
      for (let i = 1; i < rawArgs.length; i += 2) {
          criteriaSets.push({ range: ctx.getRangeValues(rawArgs[i]), criteria: args[i+1] });
      }
      for (let i = 0; i < avgRange.length; i++) {
          const match = criteriaSets.every(cs => ctx.checkCondition(cs.range[i], cs.criteria));
          if (match) {
              sum += Number(avgRange[i]) || 0;
              count++;
          }
      }
      return count > 0 ? sum / count : '#DIV/0!';
  },
  ISBLANK: (args) => args[0] === null || args[0] === '',
  ISNUMBER: (args) => typeof args[0] === 'number' || (!isNaN(Number(args[0])) && args[0] !== ''),
  ISTEXT: (args) => typeof args[0] === 'string' && isNaN(Number(args[0])),
  ISERROR: (args) => String(args[0]).startsWith('#'),
  ISODD: (args) => Number(args[0]) % 2 !== 0,
  ISEVEN: (args) => Number(args[0]) % 2 === 0,
  ISFORMULA: (args, rawArgs, ctx) => {
      const ref = ctx.parseCellRef(rawArgs[0]);
      if (!ref) return false;
      const cell = ctx.grid[ref.row]?.[ref.col];
      return cell ? cell.type === 'formula' : false;
  },
  ISREF: (args, rawArgs, ctx) => ctx.parseCellRef(rawArgs[0]) !== null,
  ISLOGICAL: (args) => typeof args[0] === 'boolean',
  ISNA: (args) => args[0] === '#N/A',
  ISNONTEXT: (args) => typeof args[0] !== 'string',
  N: (args) => {
      if (typeof args[0] === 'number') return args[0];
      if (typeof args[0] === 'boolean') return args[0] ? 1 : 0;
      return 0;
  },
  NA: () => '#N/A',
  SHEET: () => 1,
  SHEETS: () => 1,
  TYPE: (args) => {
      const v = args[0];
      if (typeof v === 'number') return 1;
      if (typeof v === 'string') return 2;
      if (typeof v === 'boolean') return 4;
      if (String(v).startsWith('#')) return 16;
      return 1;
  },
  INFO: (args) => "Web Sandbox Environment",
  SWITCH: (args) => {
      const target = args[0];
      for (let i = 1; i < args.length - 1; i += 2) {
          if (args[i] === target) return args[i+1];
      }
      return args.length % 2 === 0 ? args[args.length - 1] : '#N/A';
  },
  CELL: (args) => "Cell Format & Location Placeholder",
  "ERROR.TYPE": (args) => {
      const err = String(args[0]);
      const map: Record<string, number> = {'#NULL!':1,'#DIV/0!':2,'#VALUE!':3,'#REF!':4,'#NAME?':5,'#NUM!':6,'#N/A':7};
      return map[err] || '#N/A';
  },
  FORMULATEXT: (args, rawArgs, ctx) => {
      const ref = ctx.parseCellRef(rawArgs[0]);
      if (!ref) return '#N/A';
      const cell = ctx.grid[ref.row]?.[ref.col];
      return cell && cell.type === 'formula' ? cell.value : '#N/A';
  },
};