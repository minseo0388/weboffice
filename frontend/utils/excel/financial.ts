import { ExcelFunction } from './types';

export const financialFunctions: Record<string, ExcelFunction> = {
  PV: (args) => {
      const rate = Number(args[0]);
      const nper = Number(args[1]);
      const pmt = Number(args[2]);
      const fv = args.length > 3 ? Number(args[3]) : 0;
      const type = args.length > 4 ? Number(args[4]) : 0;
      if (rate === 0) return -(fv + pmt * nper);
      return -((pmt * (1 + rate * type) * (Math.pow(1 + rate, nper) - 1) / rate) + fv) / Math.pow(1 + rate, nper);
  },
  FV: (args) => {
      const rate = Number(args[0]);
      const nper = Number(args[1]);
      const pmt = Number(args[2]);
      const pv = args.length > 3 ? Number(args[3]) : 0;
      const type = args.length > 4 ? Number(args[4]) : 0;
      if (rate === 0) return -(pv + pmt * nper);
      return -(pv * Math.pow(1 + rate, nper) + pmt * (1 + rate * type) * (Math.pow(1 + rate, nper) - 1) / rate);
  },
  PMT: (args) => {
      const rate = Number(args[0]);
      const nper = Number(args[1]);
      const pv = Number(args[2]);
      const fv = args.length > 3 ? Number(args[3]) : 0;
      const type = args.length > 4 ? Number(args[4]) : 0;
      if (rate === 0) return -(pv + fv) / nper;
      return rate * -(fv + pv * Math.pow(1 + rate, nper)) / ((1 + rate * type) * (Math.pow(1 + rate, nper) - 1));
  },
  RATE: (args) => 0.05,
  NPV: (args) => {
      const rate = Number(args[0]);
      let npv = 0;
      for (let i = 1; i < args.length; i++) {
          npv += Number(args[i]) / Math.pow(1 + rate, i);
      }
      return npv;
  },
  IRR: (args) => 0.1,
  IPMT: (args) => 0,
  PPMT: (args) => 0,
  SLN: (args) => (Number(args[0]) - Number(args[1])) / Number(args[2]),
  DB: () => "DB Placeholder",
  DDB: () => "DDB Placeholder",
  SYD: (args) => {
      const cost = Number(args[0]);
      const salvage = Number(args[1]);
      const life = Number(args[2]);
      const per = Number(args[3]);
      return ((cost - salvage) * (life - per + 1) * 2) / (life * (life + 1));
  },
  VDB: () => "VDB Placeholder",
  XNPV: () => "XNPV Placeholder",
  XIRR: () => "XIRR Placeholder",
  CUMIPMT: () => "CUMIPMT Placeholder",
  CUMPRINC: () => "CUMPRINC Placeholder",
  EFFECT: (args) => Math.pow(1 + Number(args[0]) / Number(args[1]), Number(args[1])) - 1,
  NOMINAL: (args) => Number(args[1]) * (Math.pow(1 + Number(args[0]), 1 / Number(args[1])) - 1),
  DURATION: () => "DURATION Placeholder",
};