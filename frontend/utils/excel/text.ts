import { ExcelFunction } from './types';

export const textFunctions: Record<string, ExcelFunction> = {
  CONCATENATE: (args) => args.join(''),
  LEN: (args) => String(args[0] || '').length,
  LOWER: (args) => String(args[0] || '').toLowerCase(),
  UPPER: (args) => String(args[0] || '').toUpperCase(),
  LEFT: (args) => String(args[0] || '').substring(0, Number(args[1]) || 1),
  RIGHT: (args) => {
    const str = String(args[0] || '');
    return str.substring(str.length - (Number(args[1]) || 1));
  },
  MID: (args) => String(args[0] || '').substring((Number(args[1]) || 1) - 1, (Number(args[1]) || 1) - 1 + (Number(args[2]) || 0)),
  TRIM: (args) => String(args[0] || '').trim(),
  SUBSTITUTE: (args) => String(args[0]).split(String(args[1])).join(String(args[2])),
  REPLACE: (args) => {
      const text = String(args[0]);
      const startNum = Number(args[1]) - 1;
      const numChars = Number(args[2]);
      const newText = String(args[3]);
      return text.substring(0, startNum) + newText + text.substring(startNum + numChars);
  },
  FIND: (args) => {
      const findText = String(args[0]);
      const withinText = String(args[1]);
      const startNum = args.length > 2 ? Number(args[2]) - 1 : 0;
      const idx = withinText.indexOf(findText, startNum);
      return idx !== -1 ? idx + 1 : '#VALUE!';
  },
  SEARCH: (args) => {
      const findText = String(args[0]).toLowerCase();
      const withinText = String(args[1]).toLowerCase();
      const startNum = args.length > 2 ? Number(args[2]) - 1 : 0;
      const idx = withinText.indexOf(findText, startNum);
      return idx !== -1 ? idx + 1 : '#VALUE!';
  },
  TEXT: (args) => String(args[0]),
  VALUE: (args) => Number(args[0]),
  TEXTJOIN: (args, rawArgs, ctx) => {
      const delimiter = String(args[0]);
      const ignoreEmpty = Boolean(args[1]);
      const texts = [];
      for (let i = 2; i < rawArgs.length; i++) {
          if (rawArgs[i].includes(':')) {
              texts.push(...ctx.getRangeValues(rawArgs[i]));
          } else {
              texts.push(args[i]);
          }
      }
      return texts.filter(t => !ignoreEmpty || (t !== null && t !== '')).join(delimiter);
  },
  REPT: (args) => String(args[0]).repeat(Math.max(0, Number(args[1]))),
  PROPER: (args) => String(args[0]).toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
  CHAR: (args) => String.fromCharCode(Number(args[0])),
  CODE: (args) => String(args[0]).charCodeAt(0),
  EXACT: (args) => String(args[0]) === String(args[1]),
  CLEAN: (args) => String(args[0]).replace(/[\x00-\x1F]/g, ""),
  FIXED: (args) => Number(args[0]).toFixed(args.length > 1 ? Number(args[1]) : 2),
  NUMBERVALUE: (args) => {
      const text = String(args[0]);
      const dec = args.length > 1 ? String(args[1]) : '.';
      const grp = args.length > 2 ? String(args[2]) : ',';
      return Number(text.split(grp).join('').replace(dec, '.'));
  },
  T: (args) => typeof args[0] === 'string' ? args[0] : "",
  SEARCHB: (args, rawArgs, ctx) => ctx.callFunction("SEARCH", args, rawArgs),
  FINDB: (args, rawArgs, ctx) => ctx.callFunction("FIND", args, rawArgs),
  LEFTB: (args, rawArgs, ctx) => ctx.callFunction("LEFT", args, rawArgs),
  RIGHTB: (args, rawArgs, ctx) => ctx.callFunction("RIGHT", args, rawArgs),
  MIDB: (args, rawArgs, ctx) => ctx.callFunction("MID", args, rawArgs),
  LENB: (args) => {
      let len = 0;
      const str = String(args[0]);
      for (let i = 0; i < str.length; i++) len += str.charCodeAt(i) > 127 ? 2 : 1;
      return len;
  },
  ASC: (args) => String(args[0]).replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)),
  DBCS: (args) => String(args[0]).replace(/[!-~]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xfee0)),
  PHONETIC: (args) => args[0],
  TEXTSPLIT: (args) => String(args[0]).split(String(args[1])).join(', '),
  TEXTBEFORE: (args) => {
      const text = String(args[0]);
      const delim = String(args[1]);
      const idx = text.indexOf(delim);
      return idx !== -1 ? text.substring(0, idx) : '#N/A';
  },
  TEXTAFTER: (args) => {
      const text = String(args[0]);
      const delim = String(args[1]);
      const idx = text.indexOf(delim);
      return idx !== -1 ? text.substring(idx + delim.length) : '#N/A';
  },
};