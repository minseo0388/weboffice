package com.cloud.service;

import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.usermodel.Paragraph;
import org.apache.poi.hwpf.usermodel.Range;
import org.apache.poi.hwpf.usermodel.Table;
import org.apache.poi.hwpf.usermodel.TableIterator;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.UnderlinePatterns;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.*;

/**
 * Service for parsing and saving DOCX (Word) files using Apache POI.
 * 
 * DOCX is XML-based and much simpler than HWP binary format.
 * We use Apache POI's XWPF (XML Word Processing Format) API.
 */
@Service
public class WordService {

    /**
     * Parses a DOCX file and converts it to the unified JSON model.
     * 
     * JSON structure matches HWP/HWPX:
     * {
     *   "title": "document.docx",
     *   "format": "docx",
     *   "sectionCount": 1,
     *   "sections": [
     *     {
     *       "paragraphs": [
     *         {
     *           "text": "Paragraph text",
     *           "fontName": "Calibri",
     *           "fontSize": 11,
     *           "bold": false,
     *           "italic": false,
     *           "underline": false,
     *           "align": "left"
     *         }
     *       ]
     *     }
     *   ]
     * }
     */
    public Map<String, Object> parseDocx(MultipartFile file) throws Exception {
        try (XWPFDocument doc = new XWPFDocument(file.getInputStream())) {
            return parseDocxDocument(doc, file.getOriginalFilename(), "docx");
        }
    }

    /**
     * Extracts a single DOCX paragraph with basic formatting.
     */
    private Map<String, Object> extractDocxParagraph(XWPFParagraph para, int paragraphIndex) {
        StringBuilder text = new StringBuilder();
        boolean bold = false;
        boolean italic = false;
        boolean underline = false;
        String fontName = "Calibri";
        int fontSize = 11;
        String align = "left";

        // Extract text and first run's formatting
        int runCount = 0;
        for (XWPFRun run : para.getRuns()) {
            text.append(run.text() == null ? "" : run.text());

            // Get formatting from first non-empty run
            if (runCount == 0 && run.text() != null && !run.text().isEmpty()) {
                bold = run.isBold();
                italic = run.isItalic();
                underline = run.getUnderline() != UnderlinePatterns.NONE;

                if (run.getFontName() != null) {
                    fontName = run.getFontName();
                }

                if (run.getFontSizeAsDouble() != null) {
                    fontSize = run.getFontSizeAsDouble().intValue();
                }
            }

            runCount++;
        }

        // Get paragraph alignment
        String paraAlign = para.getAlignment() != null ? para.getAlignment().toString().toLowerCase() : "left";
        align = paraAlign.equals("center") ? "center" : 
                paraAlign.equals("right") ? "right" : 
                paraAlign.equals("both") ? "justify" : "left";

        return Map.of(
                "paragraphIndex", paragraphIndex,
                "text", text.toString(),
                "fontName", fontName,
                "fontSize", fontSize,
                "bold", bold,
                "italic", italic,
                "underline", underline,
                "align", align
        );
    }

    private List<Map<String, Object>> extractDocxTables(List<XWPFTable> tables) {
        List<Map<String, Object>> tableList = new ArrayList<>();

        for (int tableIndex = 0; tableIndex < tables.size(); tableIndex++) {
            XWPFTable table = tables.get(tableIndex);
            List<Map<String, Object>> rows = new ArrayList<>();

            for (int rowIndex = 0; rowIndex < table.getRows().size(); rowIndex++) {
                XWPFTableRow row = table.getRows().get(rowIndex);
                List<Map<String, Object>> cells = new ArrayList<>();

                for (int colIndex = 0; colIndex < row.getTableCells().size(); colIndex++) {
                    XWPFTableCell cell = row.getTableCells().get(colIndex);
                    cells.add(Map.of(
                            "row", rowIndex,
                            "col", colIndex,
                            "text", cell.getText()
                    ));
                }

                rows.add(Map.of("cells", cells));
            }

            tableList.add(Map.of(
                    "tableIndex", tableIndex,
                    "rows", rows
            ));
        }

        return tableList;
    }

    private Map<String, Object> parseDocxDocument(XWPFDocument doc, String title, String format) {
        List<Map<String, Object>> paragraphs = new ArrayList<>();
        List<XWPFParagraph> docParagraphs = doc.getParagraphs();

        for (int i = 0; i < docParagraphs.size(); i++) {
            paragraphs.add(extractDocxParagraph(docParagraphs.get(i), i));
        }

        List<Map<String, Object>> sections = new ArrayList<>();
        Map<String, Object> section = new LinkedHashMap<>();
        section.put("paragraphs", paragraphs);
        section.put("tables", extractDocxTables(doc.getTables()));
        sections.add(section);

        Map<String, Object> model = new LinkedHashMap<>();
        model.put("title", title);
        model.put("format", format);
        model.put("fileType", format);
        model.put("sectionCount", 1);
        model.put("sections", sections);
        return model;
    }

    public Map<String, Object> parseDoc(MultipartFile file) throws Exception {
        try (HWPFDocument doc = new HWPFDocument(file.getInputStream())) {
            Range range = doc.getRange();
            List<Map<String, Object>> paragraphs = new ArrayList<>();

            for (int i = 0; i < range.numParagraphs(); i++) {
                Paragraph para = range.getParagraph(i);
                paragraphs.add(Map.of(
                        "paragraphIndex", i,
                        "text", para.text().replace("\r", ""),
                        "fontName", "Times New Roman",
                        "fontSize", 11,
                        "bold", false,
                        "italic", false,
                        "underline", false,
                        "align", "left"
                ));
            }

            List<Map<String, Object>> tables = new ArrayList<>();
            TableIterator it = new TableIterator(range);
            int tableIndex = 0;
            while (it.hasNext()) {
                Table table = it.next();
                List<Map<String, Object>> rows = new ArrayList<>();
                for (int r = 0; r < table.numRows(); r++) {
                    List<Map<String, Object>> cells = new ArrayList<>();
                    for (int c = 0; c < table.getRow(r).numCells(); c++) {
                        cells.add(Map.of(
                                "row", r,
                                "col", c,
                                "text", table.getRow(r).getCell(c).text().replace("\u0007", "").replace("\r", "")
                        ));
                    }
                    rows.add(Map.of("cells", cells));
                }
                tables.add(Map.of("tableIndex", tableIndex++, "rows", rows));
            }

            Map<String, Object> section = new LinkedHashMap<>();
            section.put("paragraphs", paragraphs);
            section.put("tables", tables);

            Map<String, Object> model = new LinkedHashMap<>();
            model.put("title", file.getOriginalFilename());
            model.put("format", "doc");
            model.put("fileType", "doc");
            model.put("sectionCount", 1);
            model.put("sections", List.of(section));
            return model;
        }
    }

    /**
     * Saves edited JSON model back to a DOCX file.
     * 
     * Similar to HWP, we:
     * 1. Load the original DOCX
     * 2. Update paragraph text
     * 3. Write back to binary
     */
    public byte[] saveDocx(Map<String, Object> model, byte[] originalBytes) throws Exception {
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(originalBytes))) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> sections = (List<Map<String, Object>>) model.get("sections");

            if (sections != null && !sections.isEmpty()) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> paragraphs = (List<Map<String, Object>>) sections.get(0).get("paragraphs");

                if (paragraphs != null) {
                    for (Map<String, Object> paragraphData : paragraphs) {
                        int paragraphIndex = ((Number) paragraphData.getOrDefault("paragraphIndex", -1)).intValue();
                        if (paragraphIndex < 0 || paragraphIndex >= doc.getParagraphs().size()) {
                            continue;
                        }
                        String newText = (String) paragraphData.get("text");
                        if (newText == null) {
                            continue;
                        }
                        replaceParagraphTextPreserveStyle(doc.getParagraphs().get(paragraphIndex), newText);
                    }
                }

                @SuppressWarnings("unchecked")
                List<Map<String, Object>> tables = (List<Map<String, Object>>) sections.get(0).get("tables");
                if (tables != null) {
                    for (Map<String, Object> tableData : tables) {
                        int tableIndex = ((Number) tableData.getOrDefault("tableIndex", -1)).intValue();
                        if (tableIndex < 0 || tableIndex >= doc.getTables().size()) {
                            continue;
                        }
                        updateDocxTable(doc.getTables().get(tableIndex), tableData);
                    }
                }
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.write(baos);
            return baos.toByteArray();
        }
    }

    public byte[] saveDoc(Map<String, Object> model, byte[] originalBytes) throws Exception {
        try (HWPFDocument doc = new HWPFDocument(new ByteArrayInputStream(originalBytes))) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> sections = (List<Map<String, Object>>) model.get("sections");
            if (sections != null && !sections.isEmpty()) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> paragraphs = (List<Map<String, Object>>) sections.get(0).get("paragraphs");
                if (paragraphs != null) {
                    Range range = doc.getRange();
                    for (Map<String, Object> paragraphData : paragraphs) {
                        int paragraphIndex = ((Number) paragraphData.getOrDefault("paragraphIndex", -1)).intValue();
                        if (paragraphIndex < 0 || paragraphIndex >= range.numParagraphs()) {
                            continue;
                        }

                        String newText = (String) paragraphData.get("text");
                        if (newText == null) {
                            continue;
                        }

                        Paragraph paragraph = range.getParagraph(paragraphIndex);
                        paragraph.replaceText(paragraph.text(), newText + "\r");
                    }
                }
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.write(baos);
            return baos.toByteArray();
        }
    }

    private void replaceParagraphTextPreserveStyle(XWPFParagraph paragraph, String newText) {
        List<XWPFRun> runs = paragraph.getRuns();
        if (runs == null || runs.isEmpty()) {
            XWPFRun run = paragraph.createRun();
            run.setText(newText);
            return;
        }

        XWPFRun firstRun = runs.get(0);
        firstRun.setText("", 0);
        firstRun.setText(newText, 0);

        for (int i = runs.size() - 1; i > 0; i--) {
            paragraph.removeRun(i);
        }
    }

    @SuppressWarnings("unchecked")
    private void updateDocxTable(XWPFTable table, Map<String, Object> tableData) {
        List<Map<String, Object>> rows = (List<Map<String, Object>>) tableData.get("rows");
        if (rows == null) {
            return;
        }

        for (Map<String, Object> rowData : rows) {
            List<Map<String, Object>> cells = (List<Map<String, Object>>) rowData.get("cells");
            if (cells == null) {
                continue;
            }

            for (Map<String, Object> cellData : cells) {
                int row = ((Number) cellData.getOrDefault("row", -1)).intValue();
                int col = ((Number) cellData.getOrDefault("col", -1)).intValue();
                if (row < 0 || col < 0 || row >= table.getRows().size()) {
                    continue;
                }

                XWPFTableRow tableRow = table.getRow(row);
                if (tableRow == null || col >= tableRow.getTableCells().size()) {
                    continue;
                }

                XWPFTableCell cell = tableRow.getCell(col);
                String text = (String) cellData.get("text");
                if (text != null) {
                    cell.removeParagraph(0);
                    XWPFParagraph p = cell.addParagraph();
                    XWPFRun run = p.createRun();
                    run.setText(text);
                }
            }
        }
    }
}
