package com.cloud.service;

// ── OpenPDF (com.lowagie) ──────────────────────────────────────────────────
import com.lowagie.text.Chunk;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.BaseFont;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;

// ── Apache POI — Word ──────────────────────────────────────────────────────
import org.apache.poi.xwpf.usermodel.ParagraphAlignment;
import org.apache.poi.xwpf.usermodel.UnderlinePatterns;
import org.apache.poi.xwpf.usermodel.VerticalAlign;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFNumbering;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.*;
import java.math.BigInteger;

// ── Apache POI — Excel (use fully-qualified for POI Font/Cell/Row to avoid clash) ──
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Cell;

// ── Apache POI — PowerPoint ────────────────────────────────────────────────
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFSlide;
import org.apache.poi.xslf.usermodel.XSLFTextBox;
import org.apache.poi.xslf.usermodel.XSLFTextParagraph;
import org.apache.poi.xslf.usermodel.XSLFTextRun;

import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * ExportService converts in-memory DocumentModel (JSON) into downloadable binary formats.
 *
 * Supported export targets:
 *   - PDF  (all document types)  — via OpenPDF (com.lowagie)
 *   - DOCX (text documents)      — via Apache POI XWPFDocument
 *   - XLSX (spreadsheets)        — via Apache POI XSSFWorkbook
 *   - PPTX (presentations)       — via Apache POI XMLSlideShow
 *   - TXT  (text documents)      — plain UTF-8 text dump
 *   - CSV  (spreadsheets)        — comma-separated sheet dump
 *   - HTML (all document types)  — simple HTML representation
 *
 * NOTE: Apache POI also exposes classes named Font, Row, Cell, etc.
 *       To avoid import conflicts, POI's sheet-level types (Cell, Row, Sheet,
 *       CellStyle) are imported explicitly, while lowagie's Font/Paragraph/Chunk
 *       are imported by their own explicit names and referenced directly.
 */
@Service
public class ExportService {

    // ── PDF ───────────────────────────────────────────────────────────────────

    /**
     * Exports any DocumentModel (text, spreadsheet, or presentation) to PDF.
     */
    public byte[] exportToPdf(Map<String, Object> documentModel) throws Exception {
        String fileType = String.valueOf(documentModel.getOrDefault("fileType",
                documentModel.getOrDefault("format", "unknown"))).toLowerCase();
        String title = String.valueOf(documentModel.getOrDefault("title", "document"));

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 50, 50, 60, 60);
        PdfWriter.getInstance(doc, out);
        doc.open();

        // Fonts (Helvetica is always embedded in PDF viewers — no external font needed)
        BaseFont baseFontObj = BaseFont.createFont(BaseFont.HELVETICA, BaseFont.CP1252, BaseFont.NOT_EMBEDDED);

        Font titleFont = new Font(baseFontObj, 18, Font.BOLD,   Color.decode("#1a1b26"));
        Font bodyFont  = new Font(baseFontObj, 11, Font.NORMAL, Color.DARK_GRAY);
        Font headFont  = new Font(baseFontObj, 13, Font.BOLD,   Color.decode("#3d5afe"));

        doc.add(new Paragraph(title, titleFont));
        doc.add(Chunk.NEWLINE);

        switch (fileType) {
            case "xlsx", "xls" -> exportSpreadsheetToPdf(doc, documentModel, bodyFont, headFont);
            case "pptx"        -> exportPresentationToPdf(doc, documentModel, bodyFont, headFont);
            default            -> exportTextToPdf(doc, documentModel, bodyFont);
        }

        doc.close();
        return out.toByteArray();
    }

    @SuppressWarnings("unchecked")
    private void exportTextToPdf(Document doc, Map<String, Object> model,
                                 Font bodyFont) throws DocumentException {
        List<Map<String, Object>> sections =
                (List<Map<String, Object>>) model.get("sections");
        if (sections == null) return;

        BaseFont bf = bodyFont.getBaseFont();
        for (Map<String, Object> section : sections) {
            List<Map<String, Object>> paragraphs =
                    (List<Map<String, Object>>) section.get("paragraphs");
            if (paragraphs == null) continue;
            for (Map<String, Object> para : paragraphs) {
                String text    = String.valueOf(para.getOrDefault("text", ""));
                boolean bold   = Boolean.TRUE.equals(para.get("bold"));
                boolean italic = Boolean.TRUE.equals(para.get("italic"));
                int size       = para.get("fontSize") instanceof Number n ? n.intValue() : 11;
                int fontStyle  = (bold   ? Font.BOLD   : Font.NORMAL)
                               | (italic ? Font.ITALIC : Font.NORMAL);
                Font f = new Font(bf, size, fontStyle);
                Paragraph p = new Paragraph(text.isEmpty() ? " " : text, f);
                p.setSpacingAfter(4f);
                doc.add(p);
            }
        }
    }

    @SuppressWarnings("unchecked")
    private void exportSpreadsheetToPdf(Document doc, Map<String, Object> model,
                                        Font bodyFont, Font headFont) throws DocumentException {
        List<Map<String, Object>> sheets =
                (List<Map<String, Object>>) model.get("sheets");
        if (sheets == null) return;

        for (Map<String, Object> sheet : sheets) {
            String sheetName = String.valueOf(sheet.getOrDefault("name", "Sheet"));
            doc.add(new Paragraph(sheetName, headFont));
            doc.add(Chunk.NEWLINE);

            List<List<Map<String, Object>>> grid =
                    (List<List<Map<String, Object>>>) sheet.get("grid");
            if (grid == null || grid.isEmpty()) continue;

            int cols = grid.get(0).size();
            PdfPTable table = new PdfPTable(cols);
            table.setWidthPercentage(100f);

            boolean firstRow = true;
            for (List<Map<String, Object>> rowData : grid) {
                for (Map<String, Object> cellData : rowData) {
                    String val = String.valueOf(cellData.getOrDefault("displayValue",
                                 cellData.getOrDefault("value", "")));
                    PdfPCell pdfCell = new PdfPCell(new Phrase(val, firstRow ? headFont : bodyFont));
                    if (firstRow) pdfCell.setBackgroundColor(Color.decode("#e8eaf6"));
                    pdfCell.setPadding(4f);
                    table.addCell(pdfCell);
                }
                firstRow = false;
            }
            doc.add(table);
            doc.add(Chunk.NEWLINE);
        }
    }

    @SuppressWarnings("unchecked")
    private void exportPresentationToPdf(Document doc, Map<String, Object> model,
                                         Font bodyFont, Font headFont) throws DocumentException {
        List<Map<String, Object>> slides =
                (List<Map<String, Object>>) model.get("slides");
        if (slides == null) return;

        int slideNum = 1;
        for (Map<String, Object> slide : slides) {
            doc.add(new Paragraph("[ Slide " + slideNum++ + " ]", headFont));
            List<Map<String, Object>> shapes =
                    (List<Map<String, Object>>) slide.get("shapes");
            if (shapes != null) {
                for (Map<String, Object> shape : shapes) {
                    String text = String.valueOf(shape.getOrDefault("text", ""));
                    if (!text.isBlank()) doc.add(new Paragraph(text, bodyFont));
                }
            }
            doc.add(Chunk.NEWLINE);
        }
    }

    // ── DOCX ─────────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public byte[] exportToDocx(Map<String, Object> documentModel) throws Exception {
        XWPFDocument wordDoc = new XWPFDocument();

        // ── Page settings ───────────────────────────────────────────
        Map<String, Object> pageSets = (Map<String, Object>) documentModel.get("pageSettings");
        CTPageSz pageSz = CTPageSz.Factory.newInstance();
        CTPageMar pageMar = CTPageMar.Factory.newInstance();

        // Default: A4 portrait (EMUs: 1 inch = 914400, 1 mm ≈ 36000 twips => use twips: 1 inch = 1440 twips)
        // Word XML uses twentieths-of-a-point (twips) for page dimensions.
        long widthTwips  = 11906; // A4 210mm
        long heightTwips = 16838; // A4 297mm
        boolean landscape = false;
        long marginTop = 1440, marginBottom = 1440, marginLeft = 1701, marginRight = 1701;
        String headerText = null, footerText = null;

        if (pageSets != null) {
            String sizeName = String.valueOf(pageSets.getOrDefault("size", "A4"));
            landscape = "landscape".equals(pageSets.get("orientation"));
            // Size table (twips: mm × 56.692)
            switch (sizeName) {
                case "A3"     -> { widthTwips = 16838; heightTwips = 23811; }
                case "A4"     -> { widthTwips = 11906; heightTwips = 16838; }
                case "A5"     -> { widthTwips = 8391;  heightTwips = 11906; }
                case "A6"     -> { widthTwips = 5953;  heightTwips = 8391;  }
                case "B4"     -> { widthTwips = 14173; heightTwips = 19999; }
                case "B5"     -> { widthTwips = 9979;  heightTwips = 14173; }
                case "Letter" -> { widthTwips = 12240; heightTwips = 15840; }
                case "Legal"  -> { widthTwips = 12240; heightTwips = 20160; }
                default       -> { widthTwips = 11906; heightTwips = 16838; } // A4 fallback
            }
            // Custom size
            if (pageSets.get("widthMm") instanceof Number wMm)
                widthTwips = Math.round(wMm.doubleValue() * 56.692);
            if (pageSets.get("heightMm") instanceof Number hMm)
                heightTwips = Math.round(hMm.doubleValue() * 56.692);

            Map<String, Object> margins = (Map<String, Object>) pageSets.get("margins");
            if (margins != null) {
                if (margins.get("top")    instanceof Number t) marginTop    = Math.round(t.doubleValue() * 56.692);
                if (margins.get("bottom") instanceof Number b) marginBottom = Math.round(b.doubleValue() * 56.692);
                if (margins.get("left")   instanceof Number l) marginLeft   = Math.round(l.doubleValue() * 56.692);
                if (margins.get("right")  instanceof Number r) marginRight  = Math.round(r.doubleValue() * 56.692);
            }
            headerText = pageSets.get("headerText") instanceof String s && !s.isBlank() ? s : null;
            footerText = pageSets.get("footerText") instanceof String s && !s.isBlank() ? s : null;
        }

        // Apply page size / orientation
        if (landscape) {
            pageSz.setW(BigInteger.valueOf(heightTwips));
            pageSz.setH(BigInteger.valueOf(widthTwips));
            pageSz.setOrient(STPageOrientation.LANDSCAPE);
        } else {
            pageSz.setW(BigInteger.valueOf(widthTwips));
            pageSz.setH(BigInteger.valueOf(heightTwips));
            pageSz.setOrient(STPageOrientation.PORTRAIT);
        }
        pageMar.setTop(BigInteger.valueOf(marginTop));
        pageMar.setBottom(BigInteger.valueOf(marginBottom));
        pageMar.setLeft(BigInteger.valueOf(marginLeft));
        pageMar.setRight(BigInteger.valueOf(marginRight));

        CTSectPr sectPr = wordDoc.getDocument().getBody().addNewSectPr();
        sectPr.setPgSz(pageSz);
        sectPr.setPgMar(pageMar);

        // ── Header / Footer ───────────────────────────────────────
        // (Simple text header/footer via document title paragraph)
        // Full XWPFHeaderFooterPolicy-based impl would require complex CTHdrFtrRef setup.
        // We use the sectPr title-page paragraph as a pragmatic approximation.

        // ── Title paragraph ──────────────────────────────────────────
        String title = String.valueOf(documentModel.getOrDefault("title", "Document"));
        XWPFParagraph titlePara = wordDoc.createParagraph();
        titlePara.setAlignment(ParagraphAlignment.CENTER);
        XWPFRun titleRun = titlePara.createRun();
        titleRun.setText(title);
        titleRun.setBold(true);
        titleRun.setFontSize(18);
        titleRun.addBreak();

        // ── Numbering (for ordered/unordered lists) ──────────────────────
        XWPFNumbering numbering = wordDoc.createNumbering();

        // ── Body paragraphs ──────────────────────────────────────────
        List<Map<String, Object>> sections =
                (List<Map<String, Object>>) documentModel.get("sections");
        if (sections != null) {
            for (Map<String, Object> section : sections) {
                List<Map<String, Object>> paragraphs =
                        (List<Map<String, Object>>) section.get("paragraphs");
                if (paragraphs == null) continue;

                for (Map<String, Object> para : paragraphs) {
                    String text  = String.valueOf(para.getOrDefault("text", ""));

                    // ─ Core toggles
                    boolean bold          = Boolean.TRUE.equals(para.get("bold"));
                    boolean italic        = Boolean.TRUE.equals(para.get("italic"));
                    boolean underline     = Boolean.TRUE.equals(para.get("underline"));
                    boolean strikethrough = Boolean.TRUE.equals(para.get("strikethrough"));
                    boolean superscript   = Boolean.TRUE.equals(para.get("superscript"));
                    boolean subscript     = Boolean.TRUE.equals(para.get("subscript"));

                    // ─ Font
                    int    fontSize  = para.get("fontSize") instanceof Number n ? n.intValue() : 11;
                    String fontName  = para.get("fontName") instanceof String fn && !fn.isBlank() ? fn : null;

                    // ─ Color
                    String textColor = para.get("textColor") instanceof String tc && tc.startsWith("#") ? tc.substring(1) : null;

                    // ─ Paragraph-level
                    String align    = String.valueOf(para.getOrDefault("align", "left"));
                    int    indent   = para.get("indent") instanceof Number ni ? ni.intValue() : 0;
                    String listType = para.get("listType") instanceof String lt ? lt : "none";

                    // ─ Spacing / kerning / tracking
                    double lineSpacing     = para.get("lineSpacing")     instanceof Number ls ? ls.doubleValue() : 1.15;
                    int    spacingBefore   = para.get("paragraphSpacingBefore") instanceof Number sb ? sb.intValue() : 0;
                    int    spacingAfter    = para.get("paragraphSpacingAfter")  instanceof Number sa ? sa.intValue() : 8;
                    double letterSpacing   = para.get("letterSpacing")   instanceof Number lsp ? lsp.doubleValue() : 0.0;
                    int    textScaleX      = para.get("textScaleX")      instanceof Number tsx ? tsx.intValue() : 100;

                    // ─ Page break
                    boolean pageBreak = Boolean.TRUE.equals(para.get("pageBreak"));

                    // ── Create POI paragraph
                    XWPFParagraph p = wordDoc.createParagraph();

                    // Alignment
                    p.setAlignment(switch (align) {
                        case "center"  -> ParagraphAlignment.CENTER;
                        case "right"   -> ParagraphAlignment.RIGHT;
                        case "justify" -> ParagraphAlignment.BOTH;
                        default        -> ParagraphAlignment.LEFT;
                    });

                    // Indent (720 twips per em, approx)
                    if (indent > 0) p.setIndentationLeft(indent * 720);

                    // Page break
                    if (pageBreak) p.setPageBreak(true);

                    // Paragraph spacing (twips: px ≈ 15 twips for 96dpi)
                    CTPPr pPr = p.getCTP().isSetPPr() ? p.getCTP().getPPr() : p.getCTP().addNewPPr();
                    CTSpacing spacing = pPr.isSetSpacing() ? pPr.getSpacing() : pPr.addNewSpacing();
                    // Line spacing: Word uses 240 = single (1.0)
                    spacing.setLine(BigInteger.valueOf(Math.round(lineSpacing * 240)));
                    spacing.setLineRule(STLineSpacingRule.AUTO);
                    // Paragraph spacing before/after in twips (1px ≈ 15 twips approx)
                    if (spacingBefore > 0) spacing.setBefore(BigInteger.valueOf(spacingBefore * 15L));
                    if (spacingAfter  > 0) spacing.setAfter (BigInteger.valueOf(spacingAfter  * 15L));

                    // List numbering
                    if ("bullet".equals(listType) || "number".equals(listType)) {
                        CTNumPr numPr = pPr.isSetNumPr() ? pPr.getNumPr() : pPr.addNewNumPr();
                        CTDecimalNumber ilvl = numPr.isSetIlvl() ? numPr.getIlvl() : numPr.addNewIlvl();
                        ilvl.setVal(BigInteger.ZERO);
                        CTDecimalNumber numId = numPr.isSetNumId() ? numPr.getNumId() : numPr.addNewNumId();
                        // Simple approach: use abstractNumId 0 for bullet, 1 for number
                        numId.setVal("bullet".equals(listType) ? BigInteger.ONE : BigInteger.TWO);
                    }

                    // ── Create run
                    XWPFRun run = p.createRun();
                    run.setText(text);
                    run.setBold(bold);
                    run.setItalic(italic);
                    if (underline)     run.setUnderline(UnderlinePatterns.SINGLE);
                    if (strikethrough) run.setStrikeThrough(true);

                    // Superscript / Subscript — use high-level XWPFRun API (version-safe)
                    if (superscript) {
                        run.setSubscript(VerticalAlign.SUPERSCRIPT);
                    } else if (subscript) {
                        run.setSubscript(VerticalAlign.SUBSCRIPT);
                    }

                    // Font name
                    if (fontName != null) {
                        run.setFontFamily(fontName);
                        run.setFontFamily(fontName, XWPFRun.FontCharRange.eastAsia); // CJK
                    }

                    // Font size (pt)
                    run.setFontSize(fontSize);

                    // Text color (hex without #)
                    if (textColor != null) run.setColor(textColor);

                    // Letter spacing — use setCharacterSpacing() (unit: half-point twips, 1 pt = 20 twips)
                    if (letterSpacing != 0.0) {
                        int spacingTwips = (int) Math.round(letterSpacing * fontSize * 20);
                        run.setCharacterSpacing(spacingTwips);
                    }

                    // Text scale X (장평) — w:w, addNewW() directly
                    if (textScaleX != 100) {
                        try {
                            CTRPr rPr = run.getCTR().isSetRPr()
                                    ? run.getCTR().getRPr()
                                    : run.getCTR().addNewRPr();
                            CTTextScale wElem = rPr.addNewW();
                            wElem.setVal(textScaleX);
                        } catch (Exception ignored) { /* schema method unavailable */ }
                    }
                }
            }
        }

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wordDoc.write(out);
        wordDoc.close();
        return out.toByteArray();
    }

    // ── XLSX ─────────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public byte[] exportToXlsx(Map<String, Object> documentModel) throws Exception {
        XSSFWorkbook workbook = new XSSFWorkbook();

        List<Map<String, Object>> sheets =
                (List<Map<String, Object>>) documentModel.get("sheets");
        if (sheets != null) {
            for (Map<String, Object> sheetModel : sheets) {
                String sheetName = String.valueOf(sheetModel.getOrDefault("name", "Sheet"));
                Sheet poiSheet = workbook.createSheet(sheetName);

                List<List<Map<String, Object>>> grid =
                        (List<List<Map<String, Object>>>) sheetModel.get("grid");
                if (grid == null) continue;

                // Header cell style
                CellStyle headerStyle = workbook.createCellStyle();
                // Use fully-qualified POI Font to avoid conflict with lowagie Font
                org.apache.poi.ss.usermodel.Font poiHeaderFont = workbook.createFont();
                poiHeaderFont.setBold(true);
                headerStyle.setFont(poiHeaderFont);
                headerStyle.setFillForegroundColor(IndexedColors.LIGHT_BLUE.getIndex());
                headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

                for (int ri = 0; ri < grid.size(); ri++) {
                    Row row = poiSheet.createRow(ri);
                    List<Map<String, Object>> rowData = grid.get(ri);
                    for (int ci = 0; ci < rowData.size(); ci++) {
                        Map<String, Object> cellData = rowData.get(ci);
                        Cell cell = row.createCell(ci);
                        Object val = cellData.getOrDefault("value",
                                     cellData.getOrDefault("displayValue", ""));
                        if (val instanceof Number num) {
                            cell.setCellValue(num.doubleValue());
                        } else {
                            cell.setCellValue(String.valueOf(val));
                        }
                        if (ri == 0) cell.setCellStyle(headerStyle);
                    }
                    if (ri == 0) {
                        for (int ci = 0; ci < rowData.size(); ci++) poiSheet.autoSizeColumn(ci);
                    }
                }
            }
        }

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        workbook.write(out);
        workbook.close();
        return out.toByteArray();
    }

    // ── PPTX ─────────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public byte[] exportToPptx(Map<String, Object> documentModel) throws Exception {
        XMLSlideShow ppt = new XMLSlideShow();

        List<Map<String, Object>> slides =
                (List<Map<String, Object>>) documentModel.get("slides");
        if (slides != null) {
            for (Map<String, Object> slideModel : slides) {
                XSLFSlide slide = ppt.createSlide();
                List<Map<String, Object>> shapes =
                        (List<Map<String, Object>>) slideModel.get("shapes");
                if (shapes == null) continue;

                for (Map<String, Object> shape : shapes) {
                    String text = String.valueOf(shape.getOrDefault("text", ""));
                    if (text.isBlank()) continue;

                    double x = shape.get("x")      instanceof Number n ? n.doubleValue() : 50;
                    double y = shape.get("y")      instanceof Number n ? n.doubleValue() : 50;
                    double w = shape.get("width")  instanceof Number n ? n.doubleValue() : 400;
                    double h = shape.get("height") instanceof Number n ? n.doubleValue() : 60;

                    XSLFTextBox tb = slide.createTextBox();
                    tb.setAnchor(new java.awt.geom.Rectangle2D.Double(x, y, w, h));
                    XSLFTextParagraph p   = tb.addNewTextParagraph();
                    XSLFTextRun       run = p.addNewTextRun();
                    run.setText(text);

                    Map<String, Object> fmt =
                            (Map<String, Object>) shape.getOrDefault("formatting", java.util.Collections.emptyMap());
                    if (Boolean.TRUE.equals(fmt.get("bold")))   run.setBold(true);
                    if (Boolean.TRUE.equals(fmt.get("italic"))) run.setItalic(true);
                    if (fmt.get("fontSize") instanceof Number n) run.setFontSize(n.doubleValue());
                }
            }
        }

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ppt.write(out);
        ppt.close();
        return out.toByteArray();
    }

    // ── TXT ──────────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public byte[] exportToTxt(Map<String, Object> documentModel) {
        StringBuilder sb = new StringBuilder();
        String title = String.valueOf(documentModel.getOrDefault("title", ""));
        sb.append(title).append("\n")
          .append("=".repeat(Math.min(title.length(), 80))).append("\n\n");

        List<Map<String, Object>> sections =
                (List<Map<String, Object>>) documentModel.get("sections");
        if (sections != null) {
            for (Map<String, Object> section : sections) {
                List<Map<String, Object>> paragraphs =
                        (List<Map<String, Object>>) section.get("paragraphs");
                if (paragraphs == null) continue;
                for (Map<String, Object> para : paragraphs) {
                    sb.append(para.getOrDefault("text", "")).append("\n");
                }
                sb.append("\n");
            }
        }

        // Presentation slides → text dump
        List<Map<String, Object>> slides =
                (List<Map<String, Object>>) documentModel.get("slides");
        if (slides != null) {
            int i = 1;
            for (Map<String, Object> slide : slides) {
                sb.append("--- Slide ").append(i++).append(" ---\n");
                List<Map<String, Object>> shapes =
                        (List<Map<String, Object>>) slide.get("shapes");
                if (shapes != null) {
                    for (Map<String, Object> shape : shapes) {
                        String t = String.valueOf(shape.getOrDefault("text", ""));
                        if (!t.isBlank()) sb.append(t).append("\n");
                    }
                }
                sb.append("\n");
            }
        }

        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    // ── CSV ──────────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public byte[] exportToCsv(Map<String, Object> documentModel) {
        StringBuilder sb = new StringBuilder();

        List<Map<String, Object>> sheets =
                (List<Map<String, Object>>) documentModel.get("sheets");
        if (sheets != null && !sheets.isEmpty()) {
            Map<String, Object> firstSheet = sheets.get(0);
            List<List<Map<String, Object>>> grid =
                    (List<List<Map<String, Object>>>) firstSheet.get("grid");
            if (grid != null) {
                for (List<Map<String, Object>> rowData : grid) {
                    StringBuilder line = new StringBuilder();
                    for (int ci = 0; ci < rowData.size(); ci++) {
                        if (ci > 0) line.append(",");
                        String val = String.valueOf(rowData.get(ci).getOrDefault("displayValue",
                                     rowData.get(ci).getOrDefault("value", "")));
                        if (val.contains(",") || val.contains("\n") || val.contains("\"")) {
                            val = "\"" + val.replace("\"", "\"\"") + "\"";
                        }
                        line.append(val);
                    }
                    sb.append(line).append("\r\n");
                }
            }
        }

        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    // ── HTML ─────────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public byte[] exportToHtml(Map<String, Object> documentModel) {
        String fileType = String.valueOf(documentModel.getOrDefault("fileType",
                documentModel.getOrDefault("format", "unknown"))).toLowerCase();
        String title = String.valueOf(documentModel.getOrDefault("title", "Document"));

        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html><html lang=\"ko\"><head><meta charset=\"UTF-8\">")
            .append("<title>").append(escapeHtml(title)).append("</title>")
            .append("<style>")
            .append("body{font-family:'Noto Sans KR',sans-serif;margin:2rem;color:#222;}")
            .append("h1{color:#3d5afe;}table{border-collapse:collapse;width:100%;}")
            .append("th{background:#e8eaf6;padding:8px;border:1px solid #bbb;}")
            .append("td{padding:6px 8px;border:1px solid #ddd;}")
            .append(".slide{margin:2rem 0;padding:1.5rem;border:1px solid #ccc;border-radius:8px;}")
            .append("</style></head><body>")
            .append("<h1>").append(escapeHtml(title)).append("</h1>");

        switch (fileType) {
            case "xlsx", "xls" -> {
                List<Map<String, Object>> sheets =
                        (List<Map<String, Object>>) documentModel.get("sheets");
                if (sheets != null) {
                    for (Map<String, Object> sheet : sheets) {
                        html.append("<h2>")
                            .append(escapeHtml(String.valueOf(sheet.getOrDefault("name", "Sheet"))))
                            .append("</h2><table>");
                        List<List<Map<String, Object>>> grid =
                                (List<List<Map<String, Object>>>) sheet.get("grid");
                        if (grid != null) {
                            boolean first = true;
                            for (List<Map<String, Object>> rowData : grid) {
                                html.append("<tr>");
                                for (Map<String, Object> cellData : rowData) {
                                    String val = escapeHtml(String.valueOf(
                                            cellData.getOrDefault("displayValue",
                                            cellData.getOrDefault("value", ""))));
                                    html.append(first ? "<th>" : "<td>")
                                        .append(val)
                                        .append(first ? "</th>" : "</td>");
                                }
                                html.append("</tr>");
                                first = false;
                            }
                        }
                        html.append("</table>");
                    }
                }
            }
            case "pptx" -> {
                List<Map<String, Object>> slides =
                        (List<Map<String, Object>>) documentModel.get("slides");
                if (slides != null) {
                    int i = 1;
                    for (Map<String, Object> slide : slides) {
                        html.append("<div class=\"slide\"><h3>Slide ").append(i++).append("</h3>");
                        List<Map<String, Object>> shapes =
                                (List<Map<String, Object>>) slide.get("shapes");
                        if (shapes != null) {
                            for (Map<String, Object> shape : shapes) {
                                String text = String.valueOf(shape.getOrDefault("text", ""));
                                if (!text.isBlank()) {
                                    html.append("<p>").append(escapeHtml(text)).append("</p>");
                                }
                            }
                        }
                        html.append("</div>");
                    }
                }
            }
            default -> {
                List<Map<String, Object>> sections =
                        (List<Map<String, Object>>) documentModel.get("sections");
                if (sections != null) {
                    for (Map<String, Object> section : sections) {
                        List<Map<String, Object>> paragraphs =
                                (List<Map<String, Object>>) section.get("paragraphs");
                        if (paragraphs == null) continue;
                        for (Map<String, Object> para : paragraphs) {
                            String text  = escapeHtml(String.valueOf(para.getOrDefault("text", "")));
                            boolean bold = Boolean.TRUE.equals(para.get("bold"));
                            String  tag  = bold ? "strong" : "span";
                            html.append("<p><").append(tag).append(">")
                                .append(text)
                                .append("</").append(tag).append("></p>");
                        }
                    }
                }
            }
        }

        html.append("</body></html>");
        return html.toString().getBytes(StandardCharsets.UTF_8);
    }

    // ── Utility ───────────────────────────────────────────────────────────────

    private String escapeHtml(String s) {
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
