package com.cloud.service;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.util.*;

/**
 * ExcelService — Apache POI XSSF 전체 API 활용
 *
 * 지원 기능:
 *  파싱: 값(string/number/boolean/formula), 서식(font/color/bg/border/align),
 *        병합셀, 열너비/행높이, 동결창, AutoFilter, 시트탭색상, 이미지(base64)
 *  저장: 위 모든 항목 양방향
 */
@Service
public class ExcelService {

    public Map<String, Object> parseXlsx(MultipartFile file) throws Exception {
        return parseWorkbook(file, "xlsx");
    }

    public Map<String, Object> parseXls(MultipartFile file) throws Exception {
        return parseWorkbook(file, "xls");
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Parse
    // ══════════════════════════════════════════════════════════════════════

    private Map<String, Object> parseWorkbook(MultipartFile file, String format) throws Exception {
        try (Workbook wb = WorkbookFactory.create(file.getInputStream())) {
            List<Map<String, Object>> sheets = new ArrayList<>();
            DataFormatter fmt = new DataFormatter();
            for (int i = 0; i < wb.getNumberOfSheets(); i++) {
                sheets.add(extractSheet(wb.getSheetAt(i), i, fmt, wb));
            }
            Map<String, Object> model = new LinkedHashMap<>();
            model.put("title",      file.getOriginalFilename());
            model.put("format",     format);
            model.put("fileType",   format);
            model.put("sheetCount", wb.getNumberOfSheets());
            model.put("sheets",     sheets);
            model.put("images",     extractImages(wb));
            return model;
        }
    }

    private Map<String, Object> extractSheet(Sheet sheet, int idx, DataFormatter fmt, Workbook wb) {
        int maxRow = Math.max(sheet.getLastRowNum(), 0);
        int maxCol = getMaxCol(sheet);

        List<List<Map<String, Object>>> grid = new ArrayList<>();
        for (int r = 0; r <= maxRow; r++) {
            Row row = sheet.getRow(r);
            List<Map<String, Object>> rowData = new ArrayList<>();
            for (int c = 0; c < maxCol; c++) {
                Cell cell = row == null ? null : row.getCell(c, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                rowData.add(extractCell(cell, r, c, fmt, wb));
            }
            grid.add(rowData);
        }

        // 열너비 (characters)
        List<Double> colWidths = new ArrayList<>();
        for (int c = 0; c < maxCol; c++) {
            colWidths.add(sheet.getColumnWidth(c) / 256.0);
        }

        // 행높이 (pt)
        List<Float> rowHeights = new ArrayList<>();
        for (int r = 0; r <= maxRow; r++) {
            Row row = sheet.getRow(r);
            rowHeights.add(row != null ? row.getHeightInPoints() : sheet.getDefaultRowHeightInPoints());
        }

        // 병합셀
        List<Map<String, Object>> merges = new ArrayList<>();
        for (CellRangeAddress cra : sheet.getMergedRegions()) {
            merges.add(Map.of(
                "firstRow", cra.getFirstRow(), "lastRow",  cra.getLastRow(),
                "firstCol", cra.getFirstColumn(), "lastCol", cra.getLastColumn()
            ));
        }

        // 동결창
        int frozenRows = 0;
        int frozenCols = 0;
        Map<String, Object> freezePane = new LinkedHashMap<>();
        org.apache.poi.xssf.usermodel.XSSFSheet xSheet = sheet instanceof org.apache.poi.xssf.usermodel.XSSFSheet xs ? xs : null;
        if (xSheet != null && xSheet.getPaneInformation() != null) {
            org.apache.poi.ss.util.PaneInformation pi = xSheet.getPaneInformation();
            if (pi.isFreezePane()) {
                frozenCols = pi.getVerticalSplitLeftColumn();
                frozenRows = pi.getHorizontalSplitTopRow();
                freezePane.put("col", frozenCols);
                freezePane.put("row", frozenRows);
            }
        }

        // 시트탭 색상
        String tabColor = "";
        if (xSheet != null) {
            try {
                XSSFColor tc = xSheet.getTabColor();
                if (tc != null && tc.getARGBHex() != null) tabColor = "#" + tc.getARGBHex().substring(2);
            } catch (Exception ignored) {}
        }

        // AutoFilter 범위
        String autoFilter = "";
        if (xSheet != null && xSheet.getCTWorksheet().getAutoFilter() != null) {
            autoFilter = xSheet.getCTWorksheet().getAutoFilter().getRef();
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sheetIndex",  idx);
        result.put("name",        sheet.getSheetName());
        result.put("rowCount",    grid.size());
        result.put("columnCount", maxCol);
        result.put("grid",        grid);
        result.put("colWidths",   colWidths);
        result.put("rowHeights",  rowHeights);
        result.put("merges",      merges);
        result.put("frozenRows",  frozenRows);
        result.put("frozenCols",  frozenCols);
        result.put("freezePane",  freezePane);
        result.put("tabColor",    tabColor);
        result.put("autoFilter",  autoFilter);

        // Also mark merged cells at cell-level (future UI). This does not affect save;
        // merges are still preserved via the merges list.
        for (CellRangeAddress cra : sheet.getMergedRegions()) {
            int fr = cra.getFirstRow();
            int lr = cra.getLastRow();
            int fc = cra.getFirstColumn();
            int lc = cra.getLastColumn();
            int rowSpan = (lr - fr) + 1;
            int colSpan = (lc - fc) + 1;
            if (fr >= 0 && fr < grid.size() && fc >= 0 && !grid.get(fr).isEmpty() && fc < grid.get(fr).size()) {
                Map<String, Object> tl = grid.get(fr).get(fc);
                tl.put("merged", true);
                tl.put("rowSpan", rowSpan);
                tl.put("colSpan", colSpan);
            }
            for (int r = fr; r <= lr && r < grid.size(); r++) {
                if (r < 0) continue;
                List<Map<String, Object>> rowData = grid.get(r);
                for (int c = fc; c <= lc && c < rowData.size(); c++) {
                    if (c < 0) continue;
                    if (r == fr && c == fc) continue;
                    rowData.get(c).put("merged", true);
                }
            }
        }
        return result;
    }

    private Map<String, Object> extractCell(Cell cell, int row, int col, DataFormatter fmt, Workbook wb) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("row", row);
        m.put("col", col);

        if (cell == null) {
            m.put("type", "empty"); m.put("value", "");
            return m;
        }

        // 값
        switch (cell.getCellType()) {
            case STRING  -> { m.put("type","string");  m.put("value", cell.getStringCellValue()); }
            case NUMERIC -> { m.put("type","number");  m.put("value", cell.getNumericCellValue()); }
            case BOOLEAN -> { m.put("type","boolean"); m.put("value", cell.getBooleanCellValue()); }
            case FORMULA -> { m.put("type","formula"); m.put("value", "=" + cell.getCellFormula()); }
            default      -> { m.put("type","empty");   m.put("value", fmt.formatCellValue(cell)); }
        }
        m.put("displayValue", fmt.formatCellValue(cell));

        // 서식
        CellStyle cs = cell.getCellStyle();
        if (cs != null) {
            Font font = wb.getFontAt(cs.getFontIndex());
            m.put("bold",      font.getBold());
            m.put("italic",    font.getItalic());
            m.put("underline", font.getUnderline() != Font.U_NONE);
            m.put("fontSize",  font.getFontHeightInPoints());
            m.put("fontName",  font.getFontName());

            // 폰트 색상
            if (font instanceof XSSFFont xf) {
                XSSFColor fc = xf.getXSSFColor();
                if (fc != null && fc.getARGBHex() != null) {
                    m.put("textColor", "#" + fc.getARGBHex().substring(2));
                }
            }

            // 배경색
            if (cs instanceof XSSFCellStyle xcs) {
                XSSFColor bg = xcs.getFillForegroundXSSFColor();
                if (bg != null && bg.getARGBHex() != null) {
                    m.put("backgroundColor", "#" + bg.getARGBHex().substring(2));
                }
            }

            // 정렬
            String align = switch (cs.getAlignment()) {
                case CENTER, CENTER_SELECTION -> "center";
                case RIGHT, FILL, JUSTIFY, GENERAL, DISTRIBUTED -> "right";
                default -> "left";
            };
            m.put("align", align);

            // 숫자 포맷
            m.put("numberFormat", cs.getDataFormatString());

            // 줄바꿈
            m.put("wrapText", cs.getWrapText());

            // Preserve extra style details for future parity work.
            Map<String, Object> extended = new LinkedHashMap<>();
            extended.put("borderTop", cs.getBorderTop().getCode());
            extended.put("borderBottom", cs.getBorderBottom().getCode());
            extended.put("borderLeft", cs.getBorderLeft().getCode());
            extended.put("borderRight", cs.getBorderRight().getCode());
            extended.put("vAlign", cs.getVerticalAlignment().name().toLowerCase());
            m.put("extended", extended);
        }

        // 주석
        if (cell.getCellComment() != null) {
            m.put("comment", cell.getCellComment().getString().getString());
        }
        return m;
    }

    private List<Map<String, Object>> extractImages(Workbook wb) {
        List<Map<String, Object>> images = new ArrayList<>();
        for (PictureData pic : wb.getAllPictures()) {
            Map<String, Object> im = new LinkedHashMap<>();
            im.put("contentType", pic.getMimeType());
            im.put("base64",      java.util.Base64.getEncoder().encodeToString(pic.getData()));
            images.add(im);
        }
        return images;
    }

    private int getMaxCol(Sheet sheet) {
        int max = 0;
        for (Row row : sheet) if (row != null) max = Math.max(max, row.getLastCellNum());
        return Math.max(max, 1);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Save
    // ══════════════════════════════════════════════════════════════════════

    @SuppressWarnings("unchecked")
    public byte[] saveWorkbook(Map<String, Object> model, byte[] originalBytes) throws Exception {
        try (Workbook wb = WorkbookFactory.create(new java.io.ByteArrayInputStream(originalBytes))) {
            List<Map<String, Object>> sheets = (List<Map<String, Object>>) model.get("sheets");
            if (sheets == null) return toBytes(wb);

            // Cache styles/fonts to avoid style explosion in large sheets.
            Map<String, CellStyle> styleCache = new HashMap<>();
            Map<String, Font> fontCache = new HashMap<>();

            for (Map<String, Object> sd : sheets) {
                int si = sd.get("sheetIndex") instanceof Number n ? n.intValue() : -1;
                if (si < 0 || si >= wb.getNumberOfSheets()) continue;
                Sheet sheet = wb.getSheetAt(si);

                // 시트 이름
                if (sd.get("name") instanceof String name && !name.isBlank())
                    wb.setSheetName(si, name);

                List<List<Map<String, Object>>> grid = (List<List<Map<String, Object>>>) sd.get("grid");
                if (grid != null) {
                    for (int r = 0; r < grid.size(); r++) {
                        List<Map<String, Object>> rowData = grid.get(r);
                        if (rowData == null) continue;
                        Row row = sheet.getRow(r);
                        if (row == null) row = sheet.createRow(r);
                        for (int c = 0; c < rowData.size(); c++) {
                            Map<String, Object> cd = rowData.get(c);
                            if (cd == null) continue;
                            Cell cell = row.getCell(c, Row.MissingCellPolicy.CREATE_NULL_AS_BLANK);
                            setCellValue(cell, cd);
                            applyCellStyle(cell, cd, wb, styleCache, fontCache);
                        }
                    }
                }

                // 열 너비
                List<Number> colWidths = (List<Number>) sd.get("colWidths");
                if (colWidths != null) {
                    for (int c = 0; c < colWidths.size(); c++) {
                        if (colWidths.get(c) != null)
                            sheet.setColumnWidth(c, (int)(colWidths.get(c).doubleValue() * 256));
                    }
                }

                // 행 높이
                List<Number> rowHeights = (List<Number>) sd.get("rowHeights");
                if (rowHeights != null) {
                    for (int r = 0; r < rowHeights.size(); r++) {
                        Row row = sheet.getRow(r);
                        if (row != null && rowHeights.get(r) != null)
                            row.setHeightInPoints(rowHeights.get(r).floatValue());
                    }
                }

                // 병합셀
                // 기존 병합 제거 후 재적용
                for (int i = sheet.getNumMergedRegions() - 1; i >= 0; i--) sheet.removeMergedRegion(i);
                List<Map<String, Object>> merges = (List<Map<String, Object>>) sd.get("merges");
                if (merges != null) {
                    for (Map<String, Object> mg : merges) {
                        int fr = ((Number) mg.get("firstRow")).intValue();
                        int lr = ((Number) mg.get("lastRow")).intValue();
                        int fc = ((Number) mg.get("firstCol")).intValue();
                        int lc = ((Number) mg.get("lastCol")).intValue();
                        sheet.addMergedRegion(new CellRangeAddress(fr, lr, fc, lc));
                    }
                }

                // 동결창
                int frzRows = sd.get("frozenRows") instanceof Number n ? n.intValue() : 0;
                int frzCols = sd.get("frozenCols") instanceof Number n ? n.intValue() : 0;
                if (frzRows > 0 || frzCols > 0) {
                    sheet.createFreezePane(frzCols, frzRows);
                } else {
                    Map<String, Object> fp = (Map<String, Object>) sd.get("freezePane");
                    if (fp != null && fp.get("col") instanceof Number fc && fp.get("row") instanceof Number fr) {
                        sheet.createFreezePane(fc.intValue(), fr.intValue());
                    }
                }

                // AutoFilter
                if (sd.get("autoFilter") instanceof String af && !af.isBlank() && sheet instanceof XSSFSheet xs) {
                    xs.setAutoFilter(CellRangeAddress.valueOf(af));
                }

                // 시트탭 색상
                if (sd.get("tabColor") instanceof String tc && !tc.isBlank() && sheet instanceof XSSFSheet xs) {
                    try { xs.setTabColor(new XSSFColor(parseHex(tc), null)); } catch (Exception ignored) {}
                }
            }
            return toBytes(wb);
        }
    }

    private void setCellValue(Cell cell, Map<String, Object> cd) {
        String type = cd.get("type") instanceof String t ? t : "string";
        Object val  = cd.get("value");
        switch (type) {
            case "number"  -> { try { cell.setCellValue(Double.parseDouble(String.valueOf(val))); } catch (Exception e) { cell.setCellValue(String.valueOf(val)); } }
            case "boolean" -> cell.setCellValue(Boolean.parseBoolean(String.valueOf(val)));
            case "formula" -> { String f = String.valueOf(val); cell.setCellFormula(f.startsWith("=") ? f.substring(1) : f); }
            default        -> cell.setCellValue(String.valueOf(val == null ? "" : val));
        }
    }

    @SuppressWarnings("unchecked")
    private void applyCellStyle(
            Cell cell,
            Map<String, Object> cd,
            Workbook wb,
            Map<String, CellStyle> styleCache,
            Map<String, Font> fontCache
    ) {
        Map<String, Object> legacyStyle = (Map<String, Object>) cd.get("style");

        boolean hasAnyStyleInput = legacyStyle != null
                || cd.containsKey("bold")
                || cd.containsKey("italic")
                || cd.containsKey("underline")
                || cd.containsKey("fontSize")
                || cd.containsKey("fontName")
                || cd.containsKey("textColor")
                || cd.containsKey("backgroundColor")
                || cd.containsKey("numberFormat")
                || cd.containsKey("align")
                || cd.containsKey("wrapText");
        if (!hasAnyStyleInput) return;

        Boolean bold = readBool(cd, legacyStyle, "bold");
        Boolean italic = readBool(cd, legacyStyle, "italic");
        Boolean underline = readBool(cd, legacyStyle, "underline");
        Number fontSize = readNumber(cd, legacyStyle, "fontSize");
        String fontName = readString(cd, legacyStyle, "fontName");
        String textColor = readStringAlt(cd, legacyStyle, "textColor", "color");
        String bgColor = readStringAlt(cd, legacyStyle, "backgroundColor", "bgColor");
        String numberFormat = readStringAlt(cd, legacyStyle, "numberFormat", "numFormat");
        String hAlign = readStringAlt(cd, legacyStyle, "align", "hAlign");
        Boolean wrapText = readBool(cd, legacyStyle, "wrapText");

        CellStyle baseStyle = cell.getCellStyle();
        Font baseFont = wb.getFontAt(baseStyle.getFontIndex());

        boolean needsChange = false;
        if (bold != null && bold != baseFont.getBold()) needsChange = true;
        if (italic != null && italic != baseFont.getItalic()) needsChange = true;
        if (underline != null && underline != (baseFont.getUnderline() != Font.U_NONE)) needsChange = true;
        if (fontSize != null && fontSize.shortValue() != baseFont.getFontHeightInPoints()) needsChange = true;
        if (fontName != null && !fontName.isBlank() && !fontName.equals(baseFont.getFontName())) needsChange = true;

        if (wrapText != null && wrapText != baseStyle.getWrapText()) needsChange = true;
        if (numberFormat != null && !numberFormat.isBlank()) {
            String current = baseStyle.getDataFormatString();
            if (!numberFormat.equals(current)) needsChange = true;
        }
        if (hAlign != null && !hAlign.isBlank()) {
            String current = baseStyle.getAlignment().name().toLowerCase(Locale.ROOT);
            if (!hAlign.equalsIgnoreCase(current)) needsChange = true;
        }

        if (!needsChange && (textColor != null || bgColor != null)) {
            // Colors are only supported for XSSF in this implementation.
            needsChange = true;
        }
        if (!needsChange) return;

        String styleKey = baseStyle.getIndex()
                + "|" + String.valueOf(bold)
                + "|" + String.valueOf(italic)
                + "|" + String.valueOf(underline)
                + "|" + String.valueOf(fontSize)
                + "|" + String.valueOf(fontName)
                + "|" + String.valueOf(textColor)
                + "|" + String.valueOf(bgColor)
                + "|" + String.valueOf(numberFormat)
                + "|" + String.valueOf(hAlign)
                + "|" + String.valueOf(wrapText);

        CellStyle cached = styleCache.get(styleKey);
        if (cached != null) {
            cell.setCellStyle(cached);
            return;
        }

        CellStyle nextStyle = wb.createCellStyle();
        nextStyle.cloneStyleFrom(baseStyle);

        // Font
        Font nextFont = baseFont;
        boolean fontChanged = (bold != null) || (italic != null) || (underline != null)
                || (fontSize != null) || (fontName != null && !fontName.isBlank())
                || (textColor != null && !textColor.isBlank());

        if (fontChanged) {
            String fontKey = baseFont.getIndex()
                    + "|" + String.valueOf(bold)
                    + "|" + String.valueOf(italic)
                    + "|" + String.valueOf(underline)
                    + "|" + String.valueOf(fontSize)
                    + "|" + String.valueOf(fontName)
                    + "|" + String.valueOf(textColor);

            Font cachedFont = fontCache.get(fontKey);
            if (cachedFont == null) {
                Font f = wb.createFont();
                copyFont(baseFont, f);
                if (bold != null) f.setBold(bold);
                if (italic != null) f.setItalic(italic);
                if (underline != null) f.setUnderline(underline ? Font.U_SINGLE : Font.U_NONE);
                if (fontSize != null) f.setFontHeightInPoints(fontSize.shortValue());
                if (fontName != null && !fontName.isBlank()) f.setFontName(fontName);
                if (textColor != null && textColor.startsWith("#") && f instanceof XSSFFont xf) {
                    xf.setColor(new XSSFColor(parseHex(textColor), null));
                }
                cachedFont = f;
                fontCache.put(fontKey, cachedFont);
            }
            nextFont = cachedFont;
        }
        nextStyle.setFont(nextFont);

        // Background (XSSF only)
        if (bgColor != null && !bgColor.isBlank() && nextStyle instanceof XSSFCellStyle xcs) {
            try {
                xcs.setFillForegroundColor(new XSSFColor(parseHex(bgColor), null));
                xcs.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            } catch (Exception ignored) {}
        }

        // Alignment
        if (hAlign != null && !hAlign.isBlank()) {
            try {
                nextStyle.setAlignment(HorizontalAlignment.valueOf(hAlign.toUpperCase(Locale.ROOT)));
            } catch (Exception ignored) {
                // Accept legacy string values like "left"/"center"/"right"
                if ("center".equalsIgnoreCase(hAlign)) nextStyle.setAlignment(HorizontalAlignment.CENTER);
                else if ("right".equalsIgnoreCase(hAlign)) nextStyle.setAlignment(HorizontalAlignment.RIGHT);
                else nextStyle.setAlignment(HorizontalAlignment.LEFT);
            }
        }

        // Number format
        if (numberFormat != null && !numberFormat.isBlank()) {
            try {
                nextStyle.setDataFormat(wb.createDataFormat().getFormat(numberFormat));
            } catch (Exception ignored) {}
        }

        if (wrapText != null) nextStyle.setWrapText(wrapText);

        styleCache.put(styleKey, nextStyle);
        cell.setCellStyle(nextStyle);
    }

    private Boolean readBool(Map<String, Object> cd, Map<String, Object> legacy, String key) {
        Object v = cd.get(key);
        if (v instanceof Boolean b) return b;
        if (legacy != null) {
            Object lv = legacy.get(key);
            if (lv instanceof Boolean b) return b;
        }
        return null;
    }

    private Number readNumber(Map<String, Object> cd, Map<String, Object> legacy, String key) {
        Object v = cd.get(key);
        if (v instanceof Number n) return n;
        if (legacy != null) {
            Object lv = legacy.get(key);
            if (lv instanceof Number n) return n;
        }
        return null;
    }

    private String readString(Map<String, Object> cd, Map<String, Object> legacy, String key) {
        Object v = cd.get(key);
        if (v instanceof String s) return s;
        if (legacy != null) {
            Object lv = legacy.get(key);
            if (lv instanceof String s) return s;
        }
        return null;
    }

    private String readStringAlt(Map<String, Object> cd, Map<String, Object> legacy, String key, String legacyKey) {
        String v = readString(cd, legacy, key);
        if (v != null) return v;
        if (legacy != null) {
            Object lv = legacy.get(legacyKey);
            if (lv instanceof String s) return s;
        }
        return null;
    }

    private void copyFont(Font from, Font to) {
        try {
            to.setBold(from.getBold());
            to.setItalic(from.getItalic());
            to.setStrikeout(from.getStrikeout());
            to.setUnderline(from.getUnderline());
            to.setFontHeightInPoints(from.getFontHeightInPoints());
            to.setFontName(from.getFontName());
            to.setCharSet(from.getCharSet());
            to.setColor(from.getColor());
            to.setTypeOffset(from.getTypeOffset());
        } catch (Exception ignored) {
            // Best effort; different Font implementations vary.
        }
    }

    private byte[] toBytes(Workbook wb) throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        wb.write(baos);
        return baos.toByteArray();
    }

    private byte[] parseHex(String hex) {
        String s = hex.startsWith("#") ? hex.substring(1) : hex;
        if (s.length() == 3) s = "" + s.charAt(0)+s.charAt(0) + s.charAt(1)+s.charAt(1) + s.charAt(2)+s.charAt(2);
        int r = Integer.parseInt(s.substring(0,2),16);
        int g = Integer.parseInt(s.substring(2,4),16);
        int b = Integer.parseInt(s.substring(4,6),16);
        return new byte[]{(byte)r,(byte)g,(byte)b};
    }
}
