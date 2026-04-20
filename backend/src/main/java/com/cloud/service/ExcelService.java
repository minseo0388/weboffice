package com.cloud.service;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.util.*;

/**
 * Service for parsing and saving XLSX (Excel) files using Apache POI.
 * 
 * XLSX is XML-based with a ZIP structure (similar to DOCX).
 * We use Apache POI's XSSF (XML Spreadsheet Format) API.
 */
@Service
public class ExcelService {

    /**
     * Parses an XLSX file and converts it to the unified JSON model.
     * 
     * Note: Excel's grid-based structure doesn't map 1:1 to the document model.
     * We flatten it into rows for now. Full spreadsheet UI will come in Phase 3.
     * 
     * JSON structure:
     * {
     *   "title": "spreadsheet.xlsx",
     *   "format": "xlsx",
     *   "sheetCount": 2,
     *   "sheets": [
     *     {
     *       "name": "Sheet1",
     *       "rows": [
     *         {
     *           "cells": [
     *             { "value": "Header 1", "type": "string", "bold": true },
     *             { "value": 42, "type": "number", "bold": true }
     *           ]
     *         }
     *       ]
     *     }
     *   ]
     * }
     */
    public Map<String, Object> parseXlsx(MultipartFile file) throws Exception {
        File temp = File.createTempFile("hc_xlsx_", ".xlsx");
        try {
            file.transferTo(temp);

            XSSFWorkbook workbook = new XSSFWorkbook(new java.io.FileInputStream(temp));
            List<Map<String, Object>> sheets = new ArrayList<>();

            for (Sheet sheet : workbook) {
                Map<String, Object> sheetMap = extractSheet(sheet);
                sheets.add(sheetMap);
            }

            workbook.close();

            Map<String, Object> model = new LinkedHashMap<>();
            model.put("title", file.getOriginalFilename());
            model.put("format", "xlsx");
            model.put("sheetCount", workbook.getNumberOfSheets());
            model.put("sheets", sheets);
            model.put("note", "XLSX files are parsed into grid format. Full spreadsheet UI support in Phase 3.");

            return model;

        } finally {
            temp.delete();
        }
    }

    /**
     * Extracts a single Excel sheet into rows and cells.
     */
    private Map<String, Object> extractSheet(Sheet sheet) {
        List<Map<String, Object>> rows = new ArrayList<>();

        for (Row row : sheet) {
            List<Map<String, Object>> cells = new ArrayList<>();

            for (Cell cell : row) {
                Map<String, Object> cellMap = extractCell(cell);
                cells.add(cellMap);
            }

            if (!cells.isEmpty()) {
                rows.add(Map.of("cells", cells));
            }
        }

        return Map.of(
                "name", sheet.getSheetName(),
                "rows", rows
        );
    }

    /**
     * Extracts a single Excel cell with value and formatting.
     */
    private Map<String, Object> extractCell(Cell cell) {
        Object value = null;
        String type = "empty";

        switch (cell.getCellType()) {
            case STRING:
                value = cell.getStringCellValue();
                type = "string";
                break;
            case NUMERIC:
                value = cell.getNumericCellValue();
                type = "number";
                break;
            case BOOLEAN:
                value = cell.getBooleanCellValue();
                type = "boolean";
                break;
            case FORMULA:
                value = cell.getCellFormula();
                type = "formula";
                break;
            default:
                value = "";
                type = "empty";
        }

        CellStyle style = cell.getCellStyle();
        Font font = style != null ? cell.getSheet().getWorkbook().getFontAt(style.getFontIndex()) : null;

        boolean bold = font != null && font.getBold();
        Integer fontSize = font != null ? (int) font.getFontHeightInPoints() : 11;
        String fontName = font != null ? font.getFontName() : "Calibri";

        return Map.of(
                "value", value,
                "type", type,
                "bold", bold,
                "fontSize", fontSize,
                "fontName", fontName
        );
    }

    /**
     * Saves edited JSON model back to an XLSX file.
     * 
     * Reconstructs the workbook from the JSON representation.
     */
    public void saveXlsx(Map<String, Object> model, String outputPath) throws Exception {
        XSSFWorkbook workbook = new XSSFWorkbook();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> sheets = (List<Map<String, Object>>) model.get("sheets");

        if (sheets != null) {
            for (Map<String, Object> sheetData : sheets) {
                String sheetName = (String) sheetData.get("name");
                Sheet sheet = workbook.createSheet(sheetName != null ? sheetName : "Sheet");

                @SuppressWarnings("unchecked")
                List<Map<String, Object>> rows = (List<Map<String, Object>>) sheetData.get("rows");

                if (rows != null) {
                    int rowIndex = 0;
                    for (Map<String, Object> rowData : rows) {
                        Row row = sheet.createRow(rowIndex++);

                        @SuppressWarnings("unchecked")
                        List<Map<String, Object>> cells = (List<Map<String, Object>>) rowData.get("cells");

                        if (cells != null) {
                            int cellIndex = 0;
                            for (Map<String, Object> cellData : cells) {
                                Cell cell = row.createCell(cellIndex++);

                                Object value = cellData.get("value");
                                String type = (String) cellData.get("type");

                                // Set cell value based on type
                                if ("number".equals(type) && value instanceof Number) {
                                    cell.setCellValue(((Number) value).doubleValue());
                                } else if ("boolean".equals(type) && value instanceof Boolean) {
                                    cell.setCellValue((Boolean) value);
                                } else if (value != null) {
                                    cell.setCellValue(value.toString());
                                }

                                // Apply formatting if available
                                CellStyle style = workbook.createCellStyle();
                                Font font = workbook.createFont();

                                Boolean bold = (Boolean) cellData.get("bold");
                                if (bold != null) font.setBold(bold);

                                Integer fontSize = (Integer) cellData.get("fontSize");
                                if (fontSize != null) font.setFontHeightInPoints(fontSize.shortValue());

                                String fontName = (String) cellData.get("fontName");
                                if (fontName != null) font.setFontName(fontName);

                                style.setFont(font);
                                cell.setCellStyle(style);
                            }
                        }
                    }
                }
            }
        }

        try (java.io.FileOutputStream fos = new java.io.FileOutputStream(outputPath)) {
            workbook.write(fos);
        }
        workbook.close();
    }
}
