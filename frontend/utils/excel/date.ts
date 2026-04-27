import { ExcelFunction } from './types';

export const dateFunctions: Record<string, ExcelFunction> = {
  NOW: () => new Date().toLocaleString(),
  TODAY: () => new Date().toLocaleDateString(),
  DATE: (args) => new Date(Number(args[0]), Number(args[1]) - 1, Number(args[2])).toLocaleDateString(),
  TIME: (args) => {
      const d = new Date();
      d.setHours(Number(args[0]), Number(args[1]), Number(args[2]));
      return d.toLocaleTimeString();
  },
  YEAR: (args) => new Date(args[0]).getFullYear(),
  MONTH: (args) => new Date(args[0]).getMonth() + 1,
  DAY: (args) => new Date(args[0]).getDate(),
  HOUR: (args) => new Date(args[0]).getHours(),
  MINUTE: (args) => new Date(args[0]).getMinutes(),
  SECOND: (args) => new Date(args[0]).getSeconds(),
  NETWORKDAYS: (args) => {
      let start = new Date(args[0]);
      let end = new Date(args[1]);
      let count = 0;
      while (start <= end) {
          const day = start.getDay();
          if (day !== 0 && day !== 6) count++;
          start.setDate(start.getDate() + 1);
      }
      return count;
  },
  EDATE: (args) => {
      const d = new Date(args[0]);
      d.setMonth(d.getMonth() + Number(args[1]));
      return d.toLocaleDateString();
  },
  EOMONTH: (args) => {
      const d = new Date(args[0]);
      d.setMonth(d.getMonth() + Number(args[1]) + 1);
      d.setDate(0);
      return d.toLocaleDateString();
  },
  WEEKDAY: (args) => new Date(args[0]).getDay() + 1,
  DAYS: (args) => (new Date(args[0]).getTime() - new Date(args[1]).getTime()) / (1000 * 3600 * 24),
  DAYS360: (args) => {
      const d1 = new Date(args[0]), d2 = new Date(args[1]);
      return (d2.getFullYear() - d1.getFullYear()) * 360 + (d2.getMonth() - d1.getMonth()) * 30 + (d2.getDate() - d1.getDate());
  },
  ISOWEEKNUM: (args) => {
      const d = new Date(args[0]);
      d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  },
  WEEKNUM: (args) => {
      const d = new Date(args[0]);
      const start = new Date(d.getFullYear(), 0, 1);
      return Math.ceil((((d.getTime() - start.getTime()) / 86400000) + start.getDay() + 1) / 7);
  },
  TIMEVALUE: (args) => {
      const d = new Date(`1970-01-01 ${args[0]}`);
      return (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400;
  },
  DATEVALUE: (args) => {
      const d = new Date(args[0]);
      const start = new Date("1899-12-30");
      return Math.floor((d.getTime() - start.getTime()) / 86400000);
  },
};