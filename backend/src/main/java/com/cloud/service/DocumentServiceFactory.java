package com.cloud.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * Factory pattern for routing document parsing to the appropriate service.
 * 
 * Supported formats:
 * - .hwp, .hwpx → HWP (Korean Word Processor)
 * - .docx → Word (Microsoft)
 * - .xlsx → Excel (Microsoft)
 * - .pptx → PowerPoint (Microsoft) [Phase 3]
 * 
 * Each service converts to the unified JSON model for the web editor.
 */
@Service
public class DocumentServiceFactory {

    @Autowired
    private FontMappingService fontMappingService;

    /**
     * Routes a document to the appropriate parser based on file extension.
     * 
     * Returns a JSON model compatible with the web editor:
     * {
     *   "title": "filename.ext",
     *   "format": "hwp|hwpx|docx|xlsx|pptx",
     *   "sections": [...] or "sheets": [...]  (format-specific)
     * }
     * 
     * @throws IllegalArgumentException if format is not supported
     */
    public Map<String, Object> parseDocument(MultipartFile file) throws Exception {
        String fileName = file.getOriginalFilename();
        if (fileName == null) {
            throw new IllegalArgumentException("File name is required");
        }

        String lower = fileName.toLowerCase();

        // HWP / HWPX (Korean)
        if (lower.endsWith(".hwp") || lower.endsWith(".hwpx")) {
            return parseHwpDocument(file, lower.endsWith(".hwpx"));
        }

        // DOCX (Word)
        if (lower.endsWith(".docx")) {
            return parseWordDocument(file);
        }

        // XLSX (Excel)
        if (lower.endsWith(".xlsx")) {
            return parseExcelDocument(file);
        }

        // Legacy formats
        if (lower.endsWith(".doc")) {
            throw new UnsupportedOperationException(
                    ".doc (legacy Word format) requires additional OLE2 support. Please convert to .docx."
            );
        }

        if (lower.endsWith(".xls")) {
            throw new UnsupportedOperationException(
                    ".xls (legacy Excel format) requires additional HSSF support. Please convert to .xlsx."
            );
        }

        if (lower.endsWith(".pptx")) {
            throw new UnsupportedOperationException(
                    ".pptx (PowerPoint) support is coming in Phase 3."
            );
        }

        throw new IllegalArgumentException(
                "Unsupported file format: " + fileName + 
                "\nSupported: .hwp, .hwpx, .docx, .xlsx"
        );
    }

    /**
     * Routes HWP/HWPX files to DocumentController's existing parsers.
     * (These will be called directly from DocumentController for now)
     */
    private Map<String, Object> parseHwpDocument(MultipartFile file, boolean isHwpx) {
        // This is handled directly in DocumentController
        // Kept as reference for factory pattern completeness
        throw new UnsupportedOperationException("Call DocumentController.parseDocument() directly");
    }

    /**
     * Routes DOCX files to WordService.
     */
    private Map<String, Object> parseWordDocument(MultipartFile file) throws Exception {
        WordService wordService = new WordService();
        return wordService.parseDocx(file);
    }

    /**
     * Routes XLSX files to ExcelService.
     */
    private Map<String, Object> parseExcelDocument(MultipartFile file) throws Exception {
        ExcelService excelService = new ExcelService();
        return excelService.parseXlsx(file);
    }

    /**
     * Factory method to route save operations.
     * (Will be used in Phase 2 when save endpoint is generalized)
     */
    public void saveDocument(String format, Map<String, Object> model, String outputPath) throws Exception {
        if (format.equalsIgnoreCase("docx")) {
            WordService wordService = new WordService();
            wordService.saveDocx(model, outputPath);
        } else if (format.equalsIgnoreCase("xlsx")) {
            ExcelService excelService = new ExcelService();
            excelService.saveXlsx(model, outputPath);
        } else {
            throw new UnsupportedOperationException("Save not yet implemented for format: " + format);
        }
    }
}
