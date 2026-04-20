export type FileType =
  | 'hwp'
  | 'hwpx'
  | 'doc'
  | 'docx'
  | 'xls'
  | 'xlsx'
  | 'pptx'
  | 'unknown';

export interface Paragraph {
  paragraphIndex?: number;
  text: string;
  fontName?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textColor?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
}

export interface Section {
  paragraphs: Paragraph[];
  tables?: WordTable[];
}

export interface WordTableCell {
  row: number;
  col: number;
  text: string;
}

export interface WordTableRow {
  cells: WordTableCell[];
}

export interface WordTable {
  tableIndex: number;
  rows: WordTableRow[];
}

export interface SpreadsheetCell {
  row: number;
  col: number;
  value: string | number | boolean;
  type: 'string' | 'number' | 'boolean' | 'formula' | 'empty';
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textColor?: string;
  backgroundColor?: string;
  merged?: boolean;
}

export interface SpreadsheetSheet {
  sheetIndex: number;
  name: string;
  rowCount: number;
  columnCount: number;
  grid: SpreadsheetCell[][];
}

export interface BaseDocumentModel {
  title: string;
  format: string;
  fileType?: FileType | string;
  fontMap?: Record<string, string>;
}

export interface TextDocumentModel extends BaseDocumentModel {
  sections: Section[];
}

export interface SpreadsheetDocumentModel extends BaseDocumentModel {
  sheets: SpreadsheetSheet[];
  sheetCount?: number;
}

export interface SlideShapeFormatting {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  fontName?: string;
  color?: string;
}

export interface SlideShape {
  type: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  formatting: SlideShapeFormatting;
}

export interface PresentationSlide {
  slideNumber: number;
  shapes: SlideShape[];
}

export interface PresentationDocumentModel extends BaseDocumentModel {
  slides: PresentationSlide[];
}

export type DocumentModel = TextDocumentModel | SpreadsheetDocumentModel | PresentationDocumentModel;

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export type TextToolAction =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'underline' }
  | { type: 'textColor'; value: string }
  | { type: 'fontName'; value: string }
  | { type: 'fontSize'; value: number }
  | { type: 'align'; value: 'left' | 'center' | 'right' | 'justify' };

export type SpreadsheetToolAction =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'underline' }
  | { type: 'textColor'; value: string }
  | { type: 'backgroundColor'; value: string }
  | { type: 'mergeCell' }
  | { type: 'sortColumn'; direction: 'asc' | 'desc' }
  | { type: 'formatPainter' }
  | { type: 'formula'; value: string };

export type PresentationToolAction =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'underline' }
  | { type: 'fontSize'; value: number }
  | { type: 'fontName'; value: string }
  | { type: 'textColor'; value: string }
  | { type: 'nextSlide' }
  | { type: 'prevSlide' };

export function isSpreadsheetDocument(model: DocumentModel | null): model is SpreadsheetDocumentModel {
  if (!model) return false;
  const fileType = String(model.fileType || model.format || '').toLowerCase();
  return (fileType === 'xlsx' || fileType === 'xls') && Array.isArray((model as SpreadsheetDocumentModel).sheets);
}

export function isTextDocument(model: DocumentModel | null): model is TextDocumentModel {
  if (!model) return false;
  const fileType = String(model.fileType || model.format || '').toLowerCase();
  return Array.isArray((model as TextDocumentModel).sections)
    && fileType !== 'pptx'
    && fileType !== 'xlsx'
    && fileType !== 'xls';
}

export function isPresentationDocument(model: DocumentModel | null): model is PresentationDocumentModel {
  if (!model) return false;
  const fileType = String(model.fileType || model.format || '').toLowerCase();
  return fileType === 'pptx' && Array.isArray((model as PresentationDocumentModel).slides);
}
