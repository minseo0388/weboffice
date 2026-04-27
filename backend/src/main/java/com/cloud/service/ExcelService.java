package com.cloud.service;

import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
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
        return parseWorkbook(file, "xlsx");
    }

    public Map<String, Object> parseXls(MultipartFile file) throws Exception {
        return parseWorkbook(file, "xls");
    }

    private Map<String, Object> parseWorkbook(MultipartFile file, String format) throws Exception {
        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            List<Map<String, Object>> sheets = new ArrayList<>();
            DataFormatter formatter = new DataFormatter();

            for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
                Sheet sheet = workbook.getSheetAt(i);
                sheets.add(extractSheet(sheet, i, formatter));
            }

            Map<String, Object> model = new LinkedHashMap<>();
            model.put("title", file.getOriginalFilename());
            model.put("format", format);
            model.put("fileType", format);
            model.put("sheetCount", workbook.getNumberOfSheets());
            model.put("sheets", sheets);
            return model;
        }
    }

    /**
     * Extracts a single Excel sheet into rows and cells.
     */
    private Map<String, Object> extractSheet(Sheet sheet, int sheetIndex, DataFormatter formatter) {
        int maxRow = Math.max(sheet.getLastRowNum(), 0);
        int maxCol = getMaxColumnCount(sheet);

        List<List<Map<String, Object>>> grid = new ArrayList<>();
        for (int rowIndex = 0; rowIndex <= maxRow; rowIndex++) {
            Row row = sheet.getRow(rowIndex);
            List<Map<String, Object>> rowData = new ArrayList<>();
            for (int colIndex = 0; colIndex < maxCol; colIndex++) {
                Cell cell = row == null ? null : row.getCell(colIndex, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                rowData.add(extractCell(cell, rowIndex, colIndex, formatter));
            }
            grid.add(rowData);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sheetIndex", sheetIndex);
        result.put("name", sheet.getSheetName());
        result.put("rowCount", grid.size());
        result.put("columnCount", maxCol);
        result.put("grid", grid);
        return result;
    }

    private int getMaxColumnCount(Sheet sheet) {
        int maxCol = 0;
        for (Row row : sheet) {
            maxCol = Math.max(maxCol, row.getLastCellNum());
        }
        return Math.max(maxCol, 1);
    }

    /**
     * Extracts a single Excel cell with value and formatting.
     */
    private Map<String, Object> extractCell(Cell cell, int row, int col, DataFormatter formatter) {
        Map<String, Object> cellData = new LinkedHashMap<>();
        cellData.put("row", row);
        cellData.put("col", col);

        if (cell == null) {
            cellData.put("type", "empty");
            cellData.put("value", "");
            return cellData;
        }

        String type;
        Object value;
        switch (cell.getCellType()) {
            case STRING -> {
                type = "string";
                value = cell.getStringCellValue();
            }
            case NUMERIC -> {
                type = "number";
                value = cell.getNumericCellValue();
            }
            case BOOLEAN -> {
                type = "boolean";
                value = cell.getBooleanCellValue();
            }
            case FORMULA -> {
                type = "formula";
                value = "=" + cell.getCellFormula();
            }
            default -> {
                type = "empty";
                value = formatter.formatCellValue(cell);
            }
        }

        cellData.put("type", type);
        cellData.put("value", value);
        return cellData;
    }

    /**
     * Saves edited JSON model back to an XLSX file.
     * 
     * Reconstructs the workbook from the JSON representation.
     */
    public byte[] saveWorkbook(Map<String, Object> model, byte[] originalBytes) throws Exception {
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(originalBytes))) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> sheets = (List<Map<String, Object>>) model.get("sheets");
            if (sheets == null) {
                return originalBytes;
            }

            for (Map<String, Object> sheetData : sheets) {
                int sheetIndex = ((Number) sheetData.getOrDefault("sheetIndex", -1)).intValue();
                if (sheetIndex < 0 || sheetIndex >= workbook.getNumberOfSheets()) {
                    continue;
                }

                Sheet sheet = workbook.getSheetAt(sheetIndex);
                @SuppressWarnings("unchecked")
                List<List<Map<String, Object>>> grid = (List<List<Map<String, Object>>>) sheetData.get("grid");
                if (grid == null) {
                    continue;
                }

                for (int rowIndex = 0; rowIndex < grid.size(); rowIndex++) {
                    List<Map<String, Object>> rowData = grid.get(rowIndex);
                    if (rowData == null) {
                        continue;
                    }

                    Row row = sheet.getRow(rowIndex);
                    if (row == null) {
                        row = sheet.createRow(rowIndex);
                    }

                    for (int colIndex = 0; colIndex < rowData.size(); colIndex++) {
                        Map<String, Object> cellData = rowData.get(colIndex);
                        if (cellData == null) {
                            continue;
                        }

                        Cell cell = row.getCell(colIndex, Row.MissingCellPolicy.CREATE_NULL_AS_BLANK);
                        setCellValue(cell, cellData);
                    }
                }
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            workbook.write(baos);
            return baos.toByteArray();
        }
    }

    private void setCellValue(Cell cell, Map<String, Object> cellData) {
        String type = (String) cellData.getOrDefault("type", "string");
        Object value = cellData.get("value");

        if ("number".equals(type)) {
            if (value instanceof Number number) {
                cell.setCellValue(number.doubleValue());
            } else {
                try {
                    cell.setCellValue(Double.parseDouble(String.valueOf(value)));
                } catch (NumberFormatException ex) {
                    cell.setCellValue(String.valueOf(value == null ? "" : value));
                }
            }
            return;
        }

        if ("boolean".equals(type)) {
            if (value instanceof Boolean bool) {
                cell.setCellValue(bool);
            } else {
                cell.setCellValue(Boolean.parseBoolean(String.valueOf(value)));
            }
            return;
        }

        if ("formula".equals(type)) {
            String formulaValue = String.valueOf(value == null ? "" : value);
            if (formulaValue.startsWith("=")) {
                formulaValue = formulaValue.substring(1);
            }
            cell.setCellFormula(formulaValue);
            return;
        }

        cell.setCellValue(String.valueOf(value == null ? "" : value));
    }
}
