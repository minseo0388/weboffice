import { ExcelFunction } from './types';

export const databaseFunctions: Record<string, ExcelFunction> = {
  DSUM: (args, rawArgs, ctx) => ctx.callFunction("SUM", args, rawArgs),
  DAVERAGE: (args, rawArgs, ctx) => ctx.callFunction("AVERAGE", args, rawArgs),
  DCOUNT: (args, rawArgs, ctx) => ctx.callFunction("COUNT", args, rawArgs),
  DCOUNTA: (args, rawArgs, ctx) => ctx.callFunction("COUNTA", args, rawArgs),
  DGET: (args, rawArgs, ctx) => ctx.callFunction("INDEX", args, rawArgs),
  DMAX: (args, rawArgs, ctx) => ctx.callFunction("MAX", args, rawArgs),
  DMIN: (args, rawArgs, ctx) => ctx.callFunction("MIN", args, rawArgs),
  DPRODUCT: (args, rawArgs, ctx) => ctx.callFunction("PRODUCT", args, rawArgs),
  DSTDEV: (args, rawArgs, ctx) => ctx.callFunction("STDEV.S", args, rawArgs),
  DVAR: (args, rawArgs, ctx) => ctx.callFunction("VAR.S", args, rawArgs),
};