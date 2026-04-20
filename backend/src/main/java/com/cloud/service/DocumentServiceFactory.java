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

    private final WordService wordService;
    private final ExcelService excelService;
    private final PresentationService presentationService;

    @Autowired
    public DocumentServiceFactory(
            WordService wordService,
            ExcelService excelService,
            PresentationService presentationService
    ) {
        this.wordService = wordService;
        this.excelService = excelService;
        this.presentationService = presentationService;
    }

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

        String format = resolveFormat(fileName);

        return switch (format) {
            case "docx" -> wordService.parseDocx(file);
            case "doc" -> wordService.parseDoc(file);
            case "xlsx" -> excelService.parseXlsx(file);
            case "xls" -> excelService.parseXls(file);
            case "pptx" -> presentationService.parsePptx(file);
            default -> throw new IllegalArgumentException(
                    "Unsupported file format: " + fileName +
                    "\nSupported: .hwp, .hwpx, .docx, .doc, .xlsx, .xls, .pptx"
            );
        };
    }

    /**
     * Factory method to route save operations.
     * (Will be used in Phase 2 when save endpoint is generalized)
     */
    public byte[] saveDocument(String fileName, Map<String, Object> model, byte[] originalBytes) throws Exception {
        String format = resolveFormat(fileName);
        return switch (format) {
            case "docx" -> wordService.saveDocx(model, originalBytes);
            case "doc" -> wordService.saveDoc(model, originalBytes);
            case "xlsx", "xls" -> excelService.saveWorkbook(model, originalBytes);
            case "pptx" -> presentationService.savePptx(model, originalBytes);
            default -> throw new UnsupportedOperationException("Save not implemented for format: " + format);
        };
    }

    public String resolveFormat(String fileName) {
        String lower = fileName.toLowerCase();
        if (lower.endsWith(".hwp")) return "hwp";
        if (lower.endsWith(".hwpx")) return "hwpx";
        if (lower.endsWith(".docx")) return "docx";
        if (lower.endsWith(".doc")) return "doc";
        if (lower.endsWith(".xlsx")) return "xlsx";
        if (lower.endsWith(".xls")) return "xls";
        if (lower.endsWith(".pptx")) return "pptx";
        return "unknown";
    }

    public boolean isMicrosoftFormat(String format) {
        return "docx".equals(format)
                || "doc".equals(format)
                || "xlsx".equals(format)
                || "xls".equals(format)
                || "pptx".equals(format);
    }
}
