import { ExcelFunction } from './types';

export const webFunctions: Record<string, ExcelFunction> = {
  ENCODEURL: (args) => encodeURIComponent(String(args[0])),
  WEBSERVICE: (args) => "Web requests blocked in sandbox",
  FILTERXML: (args) => "XML parsing unavailable",
};