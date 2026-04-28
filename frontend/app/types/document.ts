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
  strikethrough?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  textColor?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  highlightColor?: string;
  indent?: number;
  listType?: 'bullet' | 'number' | 'none';
  lineSpacing?: number;
  pageBreak?: boolean;  // force page break before this paragraph
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
  displayValue?: string;        // formatted display (e.g. "1,234.56")
  type: 'string' | 'number' | 'boolean' | 'formula' | 'empty';
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textColor?: string;
  backgroundColor?: string;
  merged?: boolean;
  colSpan?: number;
  rowSpan?: number;
  numberFormat?: string;        // e.g. '0.00', '#,##0', 'yyyy-mm-dd'
  fontSize?: number;
  fontName?: string;
  align?: 'left' | 'center' | 'right';
  wrapText?: boolean;
}

export interface SpreadsheetSheet {
  sheetIndex: number;
  name: string;
  rowCount: number;
  columnCount: number;
  grid: SpreadsheetCell[][];
  frozenRows?: number;
  frozenCols?: number;
  colWidths?: number[];         // per-column width in pixels
  rowHeights?: number[];        // per-row height in pixels
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
  align?: 'left' | 'center' | 'right' | 'justify';
  bullet?: boolean;
}

export interface SlideShape {
  type: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  formatting: SlideShapeFormatting;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  imageUrl?: string;
  imageFit?: 'cover' | 'contain' | 'fill';
  rotation?: number;            // degrees
  opacity?: number;             // 0-1
  locked?: boolean;
}

export interface PresentationSlide {
  slideNumber: number;
  shapes: SlideShape[];
  notes?: string;
  isHidden?: boolean;
  backgroundColor?: string;     // slide background color
  backgroundImage?: string;     // slide background image (base64 or URL)
  transition?: 'none' | 'fade' | 'slide' | 'zoom';
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
  | { type: 'strikethrough' }
  | { type: 'superscript' }
  | { type: 'subscript' }
  | { type: 'textColor'; value: string }
  | { type: 'fontName'; value: string }
  | { type: 'fontSize'; value: number }
  | { type: 'align'; value: 'left' | 'center' | 'right' | 'justify' }
  | { type: 'highlightColor'; value: string }
  | { type: 'indent'; value: 'increase' | 'decrease' }
  | { type: 'list'; value: 'bullet' | 'number' | 'none' }
  | { type: 'lineSpacing'; value: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'addParagraph' }
  | { type: 'deleteParagraph' }
  | { type: 'insertTable'; rows: number; cols: number }
  | { type: 'insertImage'; value: string }   // base64 dataURL
  | { type: 'find'; value: string }
  | { type: 'replace'; find: string; replace: string }
  | { type: 'pageBreak' }
  | { type: 'clearFormatting' };

export type SpreadsheetToolAction =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'underline' }
  | { type: 'textColor'; value: string }
  | { type: 'backgroundColor'; value: string }
  | { type: 'mergeCell' }
  | { type: 'unmergeCell' }
  | { type: 'sortColumn'; direction: 'asc' | 'desc' }
  | { type: 'formatPainter' }
  | { type: 'formula'; value: string }
  | { type: 'insertFunction'; name: string }
  | { type: 'autoFunction'; name: 'SUM' | 'AVERAGE' | 'COUNT' | 'MIN' | 'MAX' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'addRow' }
  | { type: 'deleteRow' }
  | { type: 'addCol' }
  | { type: 'deleteCol' }
  | { type: 'addSheet' }
  | { type: 'deleteSheet' }
  | { type: 'numberFormat'; value: string }   // e.g. '0.00', '#,##0'
  | { type: 'freezeRows'; count: number }
  | { type: 'freezeCols'; count: number }
  | { type: 'filterColumn' }
  | { type: 'copyRange' }
  | { type: 'pasteRange' }
  | { type: 'alignCell'; value: 'left' | 'center' | 'right' }
  | { type: 'fontSizeCell'; value: number }
  | { type: 'fontNameCell'; value: string }
  | { type: 'wrapText' }
  | { type: 'clearCell' };

export type PresentationToolAction =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'underline' }
  | { type: 'fontSize'; value: number }
  | { type: 'fontName'; value: string }
  | { type: 'textColor'; value: string }
  | { type: 'nextSlide' }
  | { type: 'prevSlide' }
  | { type: 'addSlide' }
  | { type: 'duplicateSlide' }
  | { type: 'applySlideLayout'; layout: 'title' | 'titleContent' | 'twoContent' | 'sectionHeader' | 'blank' }
  | { type: 'deleteSlide' }
  | { type: 'addShape' }
  | { type: 'duplicateShape' }
  | { type: 'deleteShape' }
  | { type: 'align'; value: 'left' | 'center' | 'right' | 'justify' }
  | { type: 'alignOnSlide'; value: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' }
  | { type: 'alignInSelection'; value: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' }
  | { type: 'bringToFront' }
  | { type: 'sendToBack' }
  | { type: 'distributeShapes'; direction: 'horizontal' | 'vertical' }
  | { type: 'bullet' }
  | { type: 'addRect' }
  | { type: 'addEllipse' }
  | { type: 'addImage'; value: string }
  | { type: 'replaceSelectedImage'; value: string }
  | { type: 'setImageFit'; value: 'cover' | 'contain' | 'fill' }
  | { type: 'addTriangle' }
  | { type: 'addRightArrow' }
  | { type: 'addHexagon' }
  | { type: 'addStar' }
  | { type: 'addRoundRect' }
  | { type: 'addLine' }
  | { type: 'addCallout' }
  | { type: 'moveSlideUp' }
  | { type: 'moveSlideDown' }
  | { type: 'toggleSlideVisibility' }
  | { type: 'setShapeFillColor'; value: string }
  | { type: 'setShapeBorderColor'; value: string }
  | { type: 'setShapeBorderWidth'; value: number }
  | { type: 'setShapeOpacity'; value: number }
  | { type: 'setShapeRotation'; value: number }
  | { type: 'nudgeShape'; dx: number; dy: number }
  | { type: 'togglePresentMode' }
  | { type: 'updateNotes'; value: string }
  | { type: 'setSlideBackground'; value: string }  // color hex
  | { type: 'setSlideBackgroundImage'; value: string }  // base64
  | { type: 'setSlideTransition'; value: 'none' | 'fade' | 'slide' | 'zoom' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'zoomIn' }
  | { type: 'zoomOut' }
  | { type: 'lockShape' }
  | { type: 'groupShapes' }
  | { type: 'ungroupShapes' }
  | { type: 'aiTranslate' };

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
