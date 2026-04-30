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
  lineSpacing?: number;           // 줄 간격 (e.g. 1.0 ~ 3.0)
  letterSpacing?: number;         // 자간 em 단위 (e.g. -0.05 ~ 0.3)
  textScaleX?: number;            // 장평 % (e.g. 80 ~ 150, default 100)
  paragraphSpacingBefore?: number; // 문단 위 간격 (px)
  paragraphSpacingAfter?: number;  // 문단 아래 간격 (px)
  pageBreak?: boolean;
  controls?: HwpControlInfo[];
  /** Format-specific passthrough bucket (backend should preserve unknowns) */
  extended?: Record<string, unknown>;
}

export interface Section {
  paragraphs: Paragraph[];
  tables?: WordTable[];
  pageSetup?: Record<string, number>;
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
  /** Format-specific passthrough bucket (backend should preserve unknowns) */
  extended?: Record<string, unknown>;
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

/** Standard page size definitions (in mm) */
export type PageSizeName =
  | 'A3' | 'A4' | 'A5' | 'A6'
  | 'B4' | 'B5'
  | 'Letter' | 'Legal' | 'Ledger' | 'Tabloid'
  | 'Custom';

export type PageOrientation = 'portrait' | 'landscape';

export interface PageMargins {
  top: number;    // mm
  bottom: number;
  left: number;
  right: number;
  header?: number;
  footer?: number;
  gutter?: number;
}

export interface PageSettings {
  size: PageSizeName;
  orientation: PageOrientation;
  margins: PageMargins;
  /** Width and height in mm (auto-set for named sizes, user-set for Custom) */
  widthMm?: number;
  heightMm?: number;
  columns?: number;      // 다단
  columnGap?: number;    // mm
  headerText?: string;
  footerText?: string;
  showLineNumbers?: boolean;
  mirrorMargins?: boolean;
}

export const PAGE_SIZES: Record<PageSizeName, { w: number; h: number }> = {
  A3:      { w: 297,   h: 420   },
  A4:      { w: 210,   h: 297   },
  A5:      { w: 148,   h: 210   },
  A6:      { w: 105,   h: 148   },
  B4:      { w: 250,   h: 353   },
  B5:      { w: 176,   h: 250   },
  Letter:  { w: 215.9, h: 279.4 },
  Legal:   { w: 215.9, h: 355.6 },
  Ledger:  { w: 279.4, h: 431.8 },
  Tabloid: { w: 279.4, h: 431.8 },
  Custom:  { w: 210,   h: 297   },
};

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  size: 'A4',
  orientation: 'portrait',
  margins: { top: 25, bottom: 25, left: 30, right: 30, header: 15, footer: 15 },
};

export interface BaseDocumentModel {
  title: string;
  format: string;
  fileType?: FileType | string;
  fontMap?: Record<string, string>;
}

export interface TextDocumentModel extends BaseDocumentModel {
  sections: Section[];
  pageSettings?: PageSettings;
}

export interface HwpFaceName {
  name?: string;
  baseFontName?: string;
  substituteFontName?: string;
  substituteFontType?: string | null;
}

export interface HwpCharShape {
  baseSize?: number;
  bold?: boolean;
  italic?: boolean;
  superScript?: boolean;
  subScript?: boolean;
  strikeLine?: boolean;
  underlineSort?: string | null;
  fontIds?: number[];
  charSpaces?: number[] | number[];
  ratios?: number[] | number[];
  textColor?: string | null;
  underlineColor?: string | null;
  shadeColor?: string | null;
}

export interface HwpParaShape {
  alignment?: string | null;
  leftMargin?: number;
  rightMargin?: number;
  indent?: number;
  topParaSpace?: number;
  bottomParaSpace?: number;
  lineSpace?: number;
  lineSpace2?: number;
  paraLevel?: number;
}

export interface HwpBorderFill {
  property?: number | null;
  leftBorder?: string | null;
  leftBorderThickness?: string | null;
  rightBorder?: string | null;
  rightBorderThickness?: string | null;
  topBorder?: string | null;
  topBorderThickness?: string | null;
  bottomBorder?: string | null;
  bottomBorderThickness?: string | null;
  fillType?: number | null;
}

export interface HwpStyle {
  hangulName?: string;
  englishName?: string;
  nextStyleId?: number;
  languageId?: number;
  paraShapeId?: number;
  charShapeId?: number;
}

export interface HwpNumbering {
  startNumber?: number;
  levels?: number;
}

export interface HwpBullet {
  bulletChar?: string | null;
  imageBullet?: boolean;
  checkBulletChar?: string | null;
}

export interface HwpControlInfo {
  type?: string | null;
  ctrlId?: number | null;
  isField?: boolean;
  gsoType?: string | null;
  gsoId?: number;
  sectionIndex?: number;
  paragraphIndex?: number;
  paragraphText?: string;
  table?: {
    rowCount: number;
    rows: {
      cells: {
        width: number;
        height: number;
        colSpan?: number;
        rowSpan?: number;
        paragraphs: Paragraph[];
      }[];
    }[];
  };
  picture?: {
    binId: number;
    width: number;
    height: number;
    base64?: string;
  };
  paragraphs?: Paragraph[];
  extended?: Record<string, unknown>;
}

export interface HwpDocInfo {
  hangulFaceNames?: HwpFaceName[];
  englishFaceNames?: HwpFaceName[];
  hanjaFaceNames?: HwpFaceName[];
  japaneseFaceNames?: HwpFaceName[];
  etcFaceNames?: HwpFaceName[];
  symbolFaceNames?: HwpFaceName[];
  userFaceNames?: HwpFaceName[];
  charShapes?: HwpCharShape[];
  paraShapes?: HwpParaShape[];
  borderFills?: HwpBorderFill[];
  styles?: HwpStyle[];
  numberings?: HwpNumbering[];
  bullets?: HwpBullet[];
}

export interface HwpDocumentModel extends TextDocumentModel {
  docInfo?: HwpDocInfo;
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
  /** Stable PPTX shape identifier (used for lossless save). */
  shapeId?: number;
  shapeName?: string;
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
  /** Format-specific passthrough bucket (backend should preserve unknowns) */
  extended?: Record<string, unknown>;
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
  | { type: 'letterSpacing'; value: number }
  | { type: 'textScaleX'; value: number }
  | { type: 'paragraphSpacingBefore'; value: number }
  | { type: 'paragraphSpacingAfter'; value: number }
  | { type: 'setPageSize'; value: PageSizeName }
  | { type: 'setOrientation'; value: PageOrientation }
  | { type: 'setMargins'; value: Partial<PageMargins> }
  | { type: 'setColumns'; value: number }
  | { type: 'setHeaderText'; value: string }
  | { type: 'setFooterText'; value: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'addParagraph' }
  | { type: 'deleteParagraph' }
  | { type: 'insertTable'; rows: number; cols: number }
  | { type: 'insertImage'; value: string }
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
