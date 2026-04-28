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
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;

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

        String title = String.valueOf(documentModel.getOrDefault("title", "Document"));
        XWPFParagraph titlePara = wordDoc.createParagraph();
        titlePara.setAlignment(ParagraphAlignment.CENTER);
        XWPFRun titleRun = titlePara.createRun();
        titleRun.setText(title);
        titleRun.setBold(true);
        titleRun.setFontSize(18);
        titleRun.addBreak();

        List<Map<String, Object>> sections =
                (List<Map<String, Object>>) documentModel.get("sections");
        if (sections != null) {
            for (Map<String, Object> section : sections) {
                List<Map<String, Object>> paragraphs =
                        (List<Map<String, Object>>) section.get("paragraphs");
                if (paragraphs == null) continue;
                for (Map<String, Object> para : paragraphs) {
                    String text    = String.valueOf(para.getOrDefault("text", ""));
                    boolean bold   = Boolean.TRUE.equals(para.get("bold"));
                    boolean italic = Boolean.TRUE.equals(para.get("italic"));
                    boolean under  = Boolean.TRUE.equals(para.get("underline"));
                    int     size   = para.get("fontSize") instanceof Number n ? n.intValue() : 11;
                    String  align  = String.valueOf(para.getOrDefault("align", "left"));

                    XWPFParagraph p = wordDoc.createParagraph();
                    p.setAlignment(switch (align) {
                        case "center"  -> ParagraphAlignment.CENTER;
                        case "right"   -> ParagraphAlignment.RIGHT;
                        case "justify" -> ParagraphAlignment.BOTH;
                        default        -> ParagraphAlignment.LEFT;
                    });
                    XWPFRun run = p.createRun();
                    run.setText(text);
                    run.setBold(bold);
                    run.setItalic(italic);
                    if (under) run.setUnderline(UnderlinePatterns.SINGLE);
                    run.setFontSize(size);
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
