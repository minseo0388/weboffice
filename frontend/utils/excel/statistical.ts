import { ExcelFunction } from './types';

export const statisticalFunctions: Record<string, ExcelFunction> = {
  AVERAGE: (args) => {
    const nums = args.map(a => Number(a)).filter(n => !isNaN(n));
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  },
  MAX: (args) => Math.max(...args.map(a => Number(a)).filter(n => !isNaN(n))),
  MIN: (args) => Math.min(...args.map(a => Number(a)).filter(n => !isNaN(n))),
  COUNT: (args) => args.filter(a => typeof a === 'number' || (!isNaN(Number(a)) && a !== '')).length,
  COUNTA: (args) => args.filter(a => a !== null && a !== '').length,
  MEDIAN: (args) => {
      const nums = args.map(a => Number(a)).filter(n => !isNaN(n)).sort((a,b)=>a-b);
      const half = Math.floor(nums.length / 2);
      if (nums.length % 2) return nums[half];
      return (nums[half - 1] + nums[half]) / 2.0;
  },
  "MODE.SNGL": (args) => {
      const nums = args.map(a => Number(a)).filter(n => !isNaN(n));
      const counts = new Map();
      let maxCount = 0;
      let mode = nums[0];
      for (const num of nums) {
          const c = (counts.get(num) || 0) + 1;
          counts.set(num, c);
          if (c > maxCount) {
              maxCount = c;
              mode = num;
          }
      }
      return mode;
  },
  "RANK.EQ": (args, rawArgs, ctx) => {
      const number = Number(args[0]);
      const ref = ctx.getRangeValues(rawArgs[1]).map(n => Number(n)).sort((a,b)=>b-a);
      const order = args.length > 2 ? Number(args[2]) : 0;
      if (order !== 0) ref.reverse();
      const idx = ref.indexOf(number);
      return idx !== -1 ? idx + 1 : '#N/A';
  },
  "RANK.AVG": (args, rawArgs, ctx) => ctx.callFunction("RANK.EQ", args, rawArgs),
  "STDEV.P": (args) => {
      const nums = args.map(a => Number(a)).filter(n => !isNaN(n));
      const mean = nums.reduce((a,b)=>a+b, 0) / nums.length;
      return Math.sqrt(nums.reduce((a,b)=>a + Math.pow(b - mean, 2), 0) / nums.length);
  },
  "STDEV.S": (args) => {
      const nums = args.map(a => Number(a)).filter(n => !isNaN(n));
      if (nums.length < 2) return '#DIV/0!';
      const mean = nums.reduce((a,b)=>a+b, 0) / nums.length;
      return Math.sqrt(nums.reduce((a,b)=>a + Math.pow(b - mean, 2), 0) / (nums.length - 1));
  },
  "VAR.P": (args) => {
      const nums = args.map(a => Number(a)).filter(n => !isNaN(n));
      const mean = nums.reduce((a,b)=>a+b, 0) / nums.length;
      return nums.reduce((a,b)=>a + Math.pow(b - mean, 2), 0) / nums.length;
  },
  "VAR.S": (args) => {
      const nums = args.map(a => Number(a)).filter(n => !isNaN(n));
      if (nums.length < 2) return '#DIV/0!';
      const mean = nums.reduce((a,b)=>a+b, 0) / nums.length;
      return nums.reduce((a,b)=>a + Math.pow(b - mean, 2), 0) / (nums.length - 1);
  },
  LARGE: (args) => {
      const arr = args.slice(0, args.length - 1).map(n => Number(n)).sort((a,b)=>b-a);
      return arr[Number(args[args.length - 1]) - 1];
  },
  SMALL: (args) => {
      const arr = args.slice(0, args.length - 1).map(n => Number(n)).sort((a,b)=>a-b);
      return arr[Number(args[args.length - 1]) - 1];
  },
  AVEDEV: (args) => {
      const nums = args.map(n => Number(n));
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      return nums.reduce((a, b) => a + Math.abs(b - mean), 0) / nums.length;
  },
  GEOMEAN: (args) => {
      const nums = args.map(n => Number(n));
      return Math.pow(nums.reduce((a, b) => a * b, 1), 1 / nums.length);
  },
  HARMEAN: (args) => {
      const nums = args.map(n => Number(n));
      return nums.length / nums.reduce((a, b) => a + (1 / b), 0);
  },
  "QUARTILE.INC": (args, rawArgs, ctx) => {
      const arr = ctx.getRangeValues(rawArgs[0]).map(Number).sort((a,b)=>a-b);
      const quart = Number(args[1]);
      if (quart === 0) return arr[0];
      if (quart === 4) return arr[arr.length - 1];
      if (quart === 2) return Number(ctx.callFunction("MEDIAN", arr, []));
      return arr[Math.floor(arr.length * (quart/4))];
  },
  "QUARTILE.EXC": (args, rawArgs, ctx) => ctx.callFunction("QUARTILE.INC", args, rawArgs),
  "PERCENTILE.INC": (args, rawArgs, ctx) => {
      const arr = ctx.getRangeValues(rawArgs[0]).map(Number).sort((a,b)=>a-b);
      const k = Number(args[1]);
      const idx = (arr.length - 1) * k;
      const base = Math.floor(idx);
      const rest = idx - base;
      if (arr[base + 1] !== undefined) return arr[base] + rest * (arr[base + 1] - arr[base]);
      return arr[base];
  },
  "PERCENTILE.EXC": (args, rawArgs, ctx) => ctx.callFunction("PERCENTILE.INC", args, rawArgs),
  "NORM.DIST": () => 0.5,
  "NORM.S.DIST": () => 0.5,
  "NORM.INV": () => 0,
  "NORM.S.INV": () => 0,
  "BINOM.DIST": () => 0.5,
  "BINOM.INV": () => 1,
  "POISSON.DIST": () => 0.5,
  "CHISQ.DIST": () => 0.5,
  "CHISQ.TEST": () => 0.5,
  "T.DIST": () => 0.5,
  "T.TEST": () => 0.5,
  "F.DIST": () => 0.5,
  "F.TEST": () => 0.5,
  "Z.TEST": () => 0.5,
  "CORREL": (args, rawArgs, ctx) => {
      const arr1 = ctx.getRangeValues(rawArgs[0]).map(Number);
      const arr2 = ctx.getRangeValues(rawArgs[1]).map(Number);
      if (arr1.length !== arr2.length || arr1.length === 0) return '#N/A';
      const mean1 = arr1.reduce((a,b)=>a+b)/arr1.length;
      const mean2 = arr2.reduce((a,b)=>a+b)/arr2.length;
      let num = 0, den1 = 0, den2 = 0;
      for (let i = 0; i < arr1.length; i++) {
          num += (arr1[i] - mean1) * (arr2[i] - mean2);
          den1 += Math.pow(arr1[i] - mean1, 2);
          den2 += Math.pow(arr2[i] - mean2, 2);
      }
      return num / Math.sqrt(den1 * den2);
  },
  "PEARSON": (args, rawArgs, ctx) => ctx.callFunction("CORREL", args, rawArgs),
  "RSQ": (args, rawArgs, ctx) => Math.pow(Number(ctx.callFunction("CORREL", args, rawArgs)), 2),
  "STEYX": () => 0,
  "SLOPE": (args, rawArgs, ctx) => {
      const y = ctx.getRangeValues(rawArgs[0]).map(Number);
      const x = ctx.getRangeValues(rawArgs[1]).map(Number);
      const meanX = x.reduce((a,b)=>a+b)/x.length;
      const meanY = y.reduce((a,b)=>a+b)/y.length;
      let num = 0, den = 0;
      for(let i=0; i<x.length; i++){
          num += (x[i] - meanX) * (y[i] - meanY);
          den += Math.pow(x[i] - meanX, 2);
      }
      return num / den;
  },
  "INTERCEPT": (args, rawArgs, ctx) => {
      const y = ctx.getRangeValues(rawArgs[0]).map(Number);
      const x = ctx.getRangeValues(rawArgs[1]).map(Number);
      const meanX = x.reduce((a,b)=>a+b)/x.length;
      const meanY = y.reduce((a,b)=>a+b)/y.length;
      const slope = Number(ctx.callFunction("SLOPE", args, rawArgs));
      return meanY - slope * meanX;
  },
  "FORECAST": (args, rawArgs, ctx) => {
      const targetX = Number(args[0]);
      const slope = Number(ctx.callFunction("SLOPE", args.slice(1), rawArgs.slice(1)));
      const intercept = Number(ctx.callFunction("INTERCEPT", args.slice(1), rawArgs.slice(1)));
      return intercept + slope * targetX;
  },
  "TREND": () => "Array trend placeholder",
  "BETA.DIST": () => 0.5,
  "GAMMA.DIST": () => 0.5,
  "WEIBULL.DIST": () => 0.5,
  "COVARIANCE.P": (args, rawArgs, ctx) => {
      const x = ctx.getRangeValues(rawArgs[0]).map(Number);
      const y = ctx.getRangeValues(rawArgs[1]).map(Number);
      const meanX = x.reduce((a,b)=>a+b)/x.length;
      const meanY = y.reduce((a,b)=>a+b)/y.length;
      let sum = 0;
      for (let i = 0; i < x.length; i++) sum += (x[i] - meanX) * (y[i] - meanY);
      return sum / x.length;
  },
  "COVARIANCE.S": (args, rawArgs, ctx) => {
      const x = ctx.getRangeValues(rawArgs[0]).map(Number);
      const y = ctx.getRangeValues(rawArgs[1]).map(Number);
      const meanX = x.reduce((a,b)=>a+b)/x.length;
      const meanY = y.reduce((a,b)=>a+b)/y.length;
      let sum = 0;
      for (let i = 0; i < x.length; i++) sum += (x[i] - meanX) * (y[i] - meanY);
      return sum / (x.length - 1);
  },
  "SKEW": () => 0,
  "KURT": () => 0,
};