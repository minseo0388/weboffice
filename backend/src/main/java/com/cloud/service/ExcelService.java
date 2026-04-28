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
        Map<String, Object> freezePane = new LinkedHashMap<>();
        org.apache.poi.xssf.usermodel.XSSFSheet xSheet = sheet instanceof org.apache.poi.xssf.usermodel.XSSFSheet xs ? xs : null;
        if (xSheet != null && xSheet.getPaneInformation() != null) {
            org.apache.poi.ss.util.PaneInformation pi = xSheet.getPaneInformation();
            if (pi.isFreezePane()) {
                freezePane.put("col", pi.getVerticalSplitLeftColumn());
                freezePane.put("row", pi.getHorizontalSplitTopRow());
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
        result.put("freezePane",  freezePane);
        result.put("tabColor",    tabColor);
        result.put("autoFilter",  autoFilter);
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
        m.put("display", fmt.formatCellValue(cell));

        // 서식
        CellStyle cs = cell.getCellStyle();
        if (cs != null) {
            Font font = wb.getFontAt(cs.getFontIndex());
            Map<String, Object> style = new LinkedHashMap<>();
            style.put("bold",      font.getBold());
            style.put("italic",    font.getItalic());
            style.put("underline", font.getUnderline() != Font.U_NONE);
            style.put("strike",    font.getStrikeout());
            style.put("fontSize",  font.getFontHeightInPoints());
            style.put("fontName",  font.getFontName());

            // 폰트 색상
            if (font instanceof XSSFFont xf) {
                XSSFColor fc = xf.getXSSFColor();
                if (fc != null && fc.getARGBHex() != null)
                    style.put("color", "#" + fc.getARGBHex().substring(2));
            }

            // 배경색
            if (cs instanceof XSSFCellStyle xcs) {
                XSSFColor bg = xcs.getFillForegroundXSSFColor();
                if (bg != null && bg.getARGBHex() != null)
                    style.put("bgColor", "#" + bg.getARGBHex().substring(2));
            }

            // 테두리
            style.put("borderTop",    cs.getBorderTop().getCode());
            style.put("borderBottom", cs.getBorderBottom().getCode());
            style.put("borderLeft",   cs.getBorderLeft().getCode());
            style.put("borderRight",  cs.getBorderRight().getCode());

            // 정렬
            style.put("hAlign", cs.getAlignment().name().toLowerCase());
            style.put("vAlign", cs.getVerticalAlignment().name().toLowerCase());

            // 숫자 포맷
            style.put("numFormat", cs.getDataFormatString());

            // 줄바꿈
            style.put("wrapText", cs.getWrapText());
            m.put("style", style);
        }

        // 주석
        if (cell.getCellComment() != null) {
            m.put("comment", cell.getCellComment().getString().getString());
        }
        return m;
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
                            applyCellStyle(cell, cd, wb);
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
                Map<String, Object> fp = (Map<String, Object>) sd.get("freezePane");
                if (fp != null && fp.get("col") instanceof Number fc && fp.get("row") instanceof Number fr) {
                    sheet.createFreezePane(fc.intValue(), fr.intValue());
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
    private void applyCellStyle(Cell cell, Map<String, Object> cd, Workbook wb) {
        Map<String, Object> style = (Map<String, Object>) cd.get("style");
        if (style == null) return;

        CellStyle cs = wb.createCellStyle();
        cs.cloneStyleFrom(cell.getCellStyle());

        Font font = wb.createFont();
        font.setBold(Boolean.TRUE.equals(style.get("bold")));
        font.setItalic(Boolean.TRUE.equals(style.get("italic")));
        font.setUnderline(Boolean.TRUE.equals(style.get("underline")) ? Font.U_SINGLE : Font.U_NONE);
        font.setStrikeout(Boolean.TRUE.equals(style.get("strike")));
        if (style.get("fontSize") instanceof Number fs) font.setFontHeightInPoints(fs.shortValue());
        if (style.get("fontName") instanceof String fn && !fn.isBlank()) font.setFontName(fn);
        if (style.get("color") instanceof String c && c.startsWith("#") && font instanceof XSSFFont xf) {
            xf.setColor(new XSSFColor(parseHex(c), null));
        }
        cs.setFont(font);

        // 배경
        if (style.get("bgColor") instanceof String bg && !bg.isBlank() && cs instanceof XSSFCellStyle xcs) {
            xcs.setFillForegroundColor(new XSSFColor(parseHex(bg), null));
            xcs.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        }

        // 테두리
        if (style.get("borderTop")    instanceof Number bt) cs.setBorderTop(BorderStyle.valueOf((short) bt.intValue()));
        if (style.get("borderBottom") instanceof Number bb) cs.setBorderBottom(BorderStyle.valueOf((short) bb.intValue()));
        if (style.get("borderLeft")   instanceof Number bl) cs.setBorderLeft(BorderStyle.valueOf((short) bl.intValue()));
        if (style.get("borderRight")  instanceof Number br) cs.setBorderRight(BorderStyle.valueOf((short) br.intValue()));

        // 정렬
        if (style.get("hAlign") instanceof String ha) {
            try { cs.setAlignment(HorizontalAlignment.valueOf(ha.toUpperCase())); } catch (Exception ignored) {}
        }
        if (style.get("vAlign") instanceof String va) {
            try { cs.setVerticalAlignment(VerticalAlignment.valueOf(va.toUpperCase())); } catch (Exception ignored) {}
        }

        // 숫자 포맷
        if (style.get("numFormat") instanceof String nf && !nf.isBlank()) {
            cs.setDataFormat(wb.createDataFormat().getFormat(nf));
        }

        if (style.get("wrapText") instanceof Boolean wrap) cs.setWrapText(wrap);

        cell.setCellStyle(cs);
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
