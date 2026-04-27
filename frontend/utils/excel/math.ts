import { ExcelFunction } from './types';

export const mathFunctions: Record<string, ExcelFunction> = {
  SUM: (args) => args.reduce((a, b) => a + (Number(b) || 0), 0),
  PRODUCT: (args) => args.reduce((a, b) => a * (Number(b) || 1), 1),
  ABS: (args) => Math.abs(Number(args[0]) || 0),
  POWER: (args) => Math.pow(Number(args[0]) || 0, Number(args[1]) || 1),
  SQRT: (args) => Math.sqrt(Number(args[0]) || 0),
  MOD: (args) => (Number(args[0]) || 0) % (Number(args[1]) || 1),
  ROUND: (args) => {
    const num = Number(args[0]) || 0;
    const digits = Number(args[1]) || 0;
    const mult = Math.pow(10, digits);
    return Math.round(num * mult) / mult;
  },
  CEILING: (args) => Math.ceil(Number(args[0]) / Number(args[1])) * Number(args[1]),
  FLOOR: (args) => Math.floor(Number(args[0]) / Number(args[1])) * Number(args[1]),
  INT: (args) => Math.floor(Number(args[0])),
  TRUNC: (args) => {
      const num = Number(args[0]);
      const digits = args.length > 1 ? Number(args[1]) : 0;
      const mult = Math.pow(10, digits);
      return Math.trunc(num * mult) / mult;
  },
  SIN: (args) => Math.sin(Number(args[0])),
  COS: (args) => Math.cos(Number(args[0])),
  TAN: (args) => Math.tan(Number(args[0])),
  ASIN: (args) => Math.asin(Number(args[0])),
  ACOS: (args) => Math.acos(Number(args[0])),
  ATAN: (args) => Math.atan(Number(args[0])),
  ATAN2: (args) => Math.atan2(Number(args[0]), Number(args[1])),
  SINH: (args) => Math.sinh(Number(args[0])),
  COSH: (args) => Math.cosh(Number(args[0])),
  TANH: (args) => Math.tanh(Number(args[0])),
  ASINH: (args) => Math.asinh(Number(args[0])),
  ACOSH: (args) => Math.acosh(Number(args[0])),
  ATANH: (args) => Math.atanh(Number(args[0])),
  DEGREES: (args) => Number(args[0]) * (180 / Math.PI),
  RADIANS: (args) => Number(args[0]) * (Math.PI / 180),
  FACT: (args) => {
      let n = Math.floor(Number(args[0]));
      if (n < 0) return '#NUM!';
      let res = 1;
      for (let i = 2; i <= n; i++) res *= i;
      return res;
  },
  FACTDOUBLE: (args) => {
      let n = Math.floor(Number(args[0]));
      if (n < 0) return '#NUM!';
      let res = 1;
      for (let i = n; i > 0; i -= 2) res *= i;
      return res;
  },
  QUOTIENT: (args) => Math.trunc(Number(args[0]) / Number(args[1])),
  MULTINOMIAL: (args, rawArgs, ctx) => {
      const nums = args.map(Number);
      const sum = nums.reduce((a,b)=>a+b, 0);
      let num = Number(ctx.callFunction("FACT", [sum], []));
      let den = 1;
      for (let n of nums) den *= Number(ctx.callFunction("FACT", [n], []));
      return num / den;
  },
  SERIESSUM: (args, rawArgs, ctx) => {
      const x = Number(args[0]);
      const n = Number(args[1]);
      const m = Number(args[2]);
      const coeffs = ctx.getRangeValues(rawArgs[3]).map(Number);
      let sum = 0;
      for (let i = 0; i < coeffs.length; i++) {
          sum += coeffs[i] * Math.pow(x, n + i * m);
      }
      return sum;
  },
  MROUND: (args) => Math.round(Number(args[0]) / Number(args[1])) * Number(args[1]),
  COMBIN: (args) => {
      const n = Number(args[0]);
      const k = Number(args[1]);
      if (k < 0 || k > n) return '#NUM!';
      let res = 1;
      for (let i = 1; i <= k; i++) res = res * (n - i + 1) / i;
      return res;
  },
  COMBINA: (args, rawArgs, ctx) => {
      const n = Number(args[0]);
      const k = Number(args[1]);
      if (n === 0 && k === 0) return 1;
      return ctx.callFunction("COMBIN", [n + k - 1, k], []);
  },
  PERMUT: (args) => {
      const n = Number(args[0]);
      const k = Number(args[1]);
      if (k < 0 || k > n) return '#NUM!';
      let res = 1;
      for (let i = 0; i < k; i++) res *= (n - i);
      return res;
  },
  PERMUTATIONA: (args) => Math.pow(Number(args[0]), Number(args[1])),
  GCD: (args) => {
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
      return args.reduce((a, b) => gcd(Number(a), Number(b)));
  },
  LCM: (args) => {
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
      return args.reduce((a, b) => Math.abs(Number(a) * Number(b)) / gcd(Number(a), Number(b)));
  },
  ROMAN: (args) => {
      const num = Number(args[0]);
      if (num < 1 || num > 3999) return '#VALUE!';
      const lookup: Record<string, number> = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1};
      let res = '', n = num;
      for (let i in lookup) {
          while (n >= lookup[i]) {
              res += i;
              n -= lookup[i];
          }
      }
      return res;
  },
  ARABIC: (args) => {
      const r = String(args[0]).toUpperCase();
      const romanValues: Record<string, number> = {I:1,V:5,X:10,L:50,C:100,D:500,M:1000};
      let total = 0;
      for (let i = 0; i < r.length; i++) {
          const current = romanValues[r[i]];
          const next = romanValues[r[i+1]];
          if (next && current < next) {
              total -= current;
          } else {
              total += current;
          }
      }
      return total;
  },
  SUBTOTAL: (args, rawArgs, ctx) => ctx.callFunction("SUM", args.slice(1), rawArgs.slice(1)),
  EXP: (args) => Math.exp(Number(args[0])),
  LN: (args) => Math.log(Number(args[0])),
  LOG: (args) => Math.log(Number(args[0])) / Math.log(args.length > 1 ? Number(args[1]) : 10),
  LOG10: (args) => Math.log10(Number(args[0])),
  PI: () => Math.PI,
  SUMPRODUCT: (args, rawArgs, ctx) => {
      let arrays = rawArgs.map(r => ctx.getRangeValues(r).map(Number));
      if (arrays.length === 0) return 0;
      let len = arrays[0].length;
      let sum = 0;
      for (let i = 0; i < len; i++) {
          let prod = 1;
          for (let j = 0; j < arrays.length; j++) prod *= (arrays[j][i] || 0);
          sum += prod;
      }
      return sum;
  },
  ROUNDUP: (args) => {
      const num = Number(args[0]) || 0;
      const digits = Number(args[1]) || 0;
      const mult = Math.pow(10, digits);
      return Math.ceil(num * mult) / mult;
  },
  ROUNDDOWN: (args) => {
      const num = Number(args[0]) || 0;
      const digits = Number(args[1]) || 0;
      const mult = Math.pow(10, digits);
      return Math.floor(num * mult) / mult;
  },
  SUMSQ: (args) => args.reduce((a, b) => a + Math.pow(Number(b) || 0, 2), 0),
  SUMX2MY2: (args, rawArgs, ctx) => {
      const x = ctx.getRangeValues(rawArgs[0]).map(Number);
      const y = ctx.getRangeValues(rawArgs[1]).map(Number);
      return x.reduce((sum, val, i) => sum + (Math.pow(val, 2) - Math.pow(y[i] || 0, 2)), 0);
  },
  SUMX2PY2: (args, rawArgs, ctx) => {
      const x = ctx.getRangeValues(rawArgs[0]).map(Number);
      const y = ctx.getRangeValues(rawArgs[1]).map(Number);
      return x.reduce((sum, val, i) => sum + (Math.pow(val, 2) + Math.pow(y[i] || 0, 2)), 0);
  },
  SUMXMY2: (args, rawArgs, ctx) => {
      const x = ctx.getRangeValues(rawArgs[0]).map(Number);
      const y = ctx.getRangeValues(rawArgs[1]).map(Number);
      return x.reduce((sum, val, i) => sum + Math.pow(val - (y[i] || 0), 2), 0);
  },
  MDETERM: () => "Matrix Math Placeholder",
  MINVERSE: () => "Matrix Math Placeholder",
  MMULT: () => "Matrix Math Placeholder",
  SEC: (args) => 1 / Math.cos(Number(args[0])),
  CSC: (args) => 1 / Math.sin(Number(args[0])),
  COT: (args) => 1 / Math.tan(Number(args[0])),
};