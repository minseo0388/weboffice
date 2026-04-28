package com.cloud.controller;

import com.cloud.model.UserPrincipal;
import com.cloud.service.DocumentSaveService;
import com.cloud.service.DocumentServiceFactory;
import com.cloud.service.ExportService;
import com.cloud.service.FontMappingService;
import com.cloud.service.HwpxService;
import com.cloud.service.StorageService;
import kr.dogfoot.hwplib.object.HWPFile;
import kr.dogfoot.hwplib.object.bodytext.Section;
import kr.dogfoot.hwplib.object.bodytext.paragraph.Paragraph;
import kr.dogfoot.hwplib.object.bodytext.paragraph.text.HWPChar;
import kr.dogfoot.hwplib.object.bodytext.paragraph.text.HWPCharNormal;
import kr.dogfoot.hwplib.reader.HWPReader;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.InputStream;
import java.util.*;

/**
 * Converts HWP/HWPX to a structured JSON model for the web editor.
 * Uses hwplib (neolord0) for binary HWP parsing.
 *
 * JSON model shape:
 * {
 *   "title": "filename.hwp",
 *   "sectionCount": 2,
 *   "sections": [
 *     {
 *       "paragraphs": [
 *         {
 *           "text": "안녕하세요",
 *           "fontName": "NanumGothic",  ← already substituted via FontMappingService
 *           "fontSize": 14,
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
@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    private final FontMappingService fontMappingService;
    private final DocumentServiceFactory documentServiceFactory;
    private final StorageService storageService;
    @SuppressWarnings("unused") // reserved for future HWP/DOCX save operations
    private final DocumentSaveService documentSaveService;
    private final ExportService exportService;
    private final HwpxService hwpxService;

    @Autowired
    public DocumentController(
            FontMappingService fontMappingService,
            DocumentServiceFactory documentServiceFactory,
            StorageService storageService,
            DocumentSaveService documentSaveService,
            ExportService exportService,
            HwpxService hwpxService
    ) {
        this.fontMappingService = fontMappingService;
        this.documentServiceFactory = documentServiceFactory;
        this.storageService = storageService;
        this.documentSaveService = documentSaveService;
        this.exportService = exportService;
        this.hwpxService = hwpxService;
    }

    /**
     * POST /api/documents/parse
     * Accepts a multipart HWP or HWPX file and converts it to a JSON model.
     */
    @PostMapping("/parse")
    public ResponseEntity<Map<String, Object>> parseDocument(@RequestParam("file") MultipartFile file) {
        String originalName = file.getOriginalFilename();
        if (originalName == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "파일명이 없습니다."));
        }

        String lower = originalName.toLowerCase();
        try {
            if (lower.endsWith(".hwp")) {
                // HWP binary — viewer mode only
                Map<String, Object> model = new LinkedHashMap<>(parseHwp(file).getBody() != null
                        ? Objects.requireNonNull(parseHwp(file).getBody()) : Map.of());
                model.put("readOnly", true);
                model.put("readOnlyReason", "HWP 바이너리 형식은 뼏어보기 전용입니다. 수정하려면 HWPX로 변환하세요.");
                return ResponseEntity.ok(model);
            } else if (lower.endsWith(".hwpx")) {
                // HWPX — full parsing via HwpxService (hwpxlib)
                Map<String, Object> model = hwpxService.parseHwpx(file);
                model.put("fontMap", fontMappingService.getFullMap());
                return ResponseEntity.ok(model);
            } else {
                Map<String, Object> model = documentServiceFactory.parseDocument(file);
                model.put("fontMap", fontMappingService.getFullMap());
                model.put("fileType", String.valueOf(model.getOrDefault("fileType", model.getOrDefault("format", "unknown"))));
                return ResponseEntity.ok(model);
            }
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(
                    Map.of("error", "파싱 실패: " + e.getMessage())
            );
        }
    }

    /**
     * POST /api/documents/save
     * Accepts a JSON model of edited content and saves it back to the original HWP/HWPX file.
     * The file is identified by fileName and overwritten in the user's storage location.
     *
     * Request body:
     * {
     *   "fileName": "document.hwp",
     *   "sections": [
     *     {
     *       "paragraphs": [
     *         { "text": "edited text", "fontSize": 14, "bold": true, ... }
     *       ]
     *     }
     *   ]
     * }
     *
     * Response:
     * {
     *   "success": true,
     *   "fileName": "document.hwp",
     *   "message": "Document saved successfully.",
     *   "savedBytes": 12345
     * }
     */
    @PostMapping("/save")
    public ResponseEntity<Map<String, Object>> saveDocument(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestBody Map<String, Object> body) {
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        try {
            String fileName = (String) body.get("fileName");
            if (fileName == null || fileName.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "fileName is required"));
            }

                @SuppressWarnings("unchecked")
                Map<String, Object> documentModel = (Map<String, Object>) body.get("documentModel");
                if (documentModel == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "documentModel is required"));
            }

                    String format = documentServiceFactory.resolveFormat(fileName);

                    if ("hwp".equals(format)) {
                        return ResponseEntity.status(400).body(Map.of(
                            "error", "HWP 파일은 뼏어보기 전용입니다. 내보내기 메뉴에서 HWPX 또는 DOCX로 다운로드하세요.",
                            "readOnly", true
                        ));
                    }

                    if ("hwpx".equals(format)) {
                        @SuppressWarnings("unchecked")
                        List<Map<String, Object>> sections = (List<Map<String, Object>>) documentModel.get("sections");
                        if (sections == null) {
                            return ResponseEntity.badRequest().body(Map.of("error", "documentModel.sections is required for HWPX"));
                        }

                        // Download original HWPX from storage, save via HwpxService
                        InputStream originalStream = storageService.downloadFile(user, fileName);
                        byte[] originalBytes = originalStream.readAllBytes();
                        byte[] updatedBytes  = hwpxService.saveHwpx(originalBytes, documentModel);
                        storageService.uploadFile(user, fileName, updatedBytes);

                        return ResponseEntity.ok(Map.of(
                            "success", true,
                            "fileName", fileName,
                            "fileType", format,
                            "message", "HWPX 저장 완료.",
                            "savedBytes", updatedBytes.length
                        ));
                    }

                StorageService.SaveResult response = storageService.saveEditorContent(user, fileName, documentModel);

            return ResponseEntity.ok(Map.of(
                        "success", true,
                    "fileName", response.fileName(),
                    "fileType", response.fileType(),
                    "message", "Document saved successfully.",
                    "savedBytes", response.savedBytes()
            ));

            } catch (IllegalStateException e) {
                return ResponseEntity.status(413).body(
                    Map.of("error", "Save rejected: " + e.getMessage())
                );

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(
                    Map.of("error", "Save failed: " + e.getMessage())
            );
        }
    }

    /**
     * POST /api/documents/export
     * Universal export endpoint. Converts the in-memory DocumentModel to the requested format.
     *
     * Request body:
     * {
     *   "format": "pdf" | "docx" | "hwpx" | "xlsx" | "pptx" | "txt" | "csv" | "html",
     *   "fileName": "original-filename.hwpx",
     *   "documentModel": { ... }
     * }
     *
     * HWPX: uses HwpxService (hwpxlib 1.0.8) — BlankFileMaker + HWPXWriter
     * HWP:  viewer-only, not exportable back to HWP binary
     */
    @PostMapping("/export")
    public ResponseEntity<byte[]> exportDocument(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestBody Map<String, Object> body) {

        if (user == null) return ResponseEntity.status(401).build();

        String format = String.valueOf(body.getOrDefault("format", "pdf")).toLowerCase();
        String fileName = String.valueOf(body.getOrDefault("fileName", "document"));
        String baseName = fileName.contains(".") ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;

        @SuppressWarnings("unchecked")
        Map<String, Object> documentModel = (Map<String, Object>) body.get("documentModel");
        if (documentModel == null) {
            return ResponseEntity.badRequest().build();
        }

        try {
            byte[] data;
            String outName;
            String contentType;

            switch (format) {
                case "pdf" -> {
                    data        = exportService.exportToPdf(documentModel);
                    outName     = baseName + ".pdf";
                    contentType = "application/pdf";
                }
                case "docx" -> {
                    data        = exportService.exportToDocx(documentModel);
                    outName     = baseName + ".docx";
                    contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                }
                case "hwpx" -> {
                    data        = hwpxService.exportToHwpx(documentModel);
                    outName     = baseName + ".hwpx";
                    contentType = "application/hwpx+zip";
                }
                case "xlsx" -> {
                    data        = exportService.exportToXlsx(documentModel);
                    outName     = baseName + ".xlsx";
                    contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                }
                case "pptx" -> {
                    data        = exportService.exportToPptx(documentModel);
                    outName     = baseName + ".pptx";
                    contentType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
                }
                case "txt" -> {
                    data        = exportService.exportToTxt(documentModel);
                    outName     = baseName + ".txt";
                    contentType = "text/plain;charset=UTF-8";
                }
                case "csv" -> {
                    data        = exportService.exportToCsv(documentModel);
                    outName     = baseName + ".csv";
                    contentType = "text/csv;charset=UTF-8";
                }
                case "html" -> {
                    data        = exportService.exportToHtml(documentModel);
                    outName     = baseName + ".html";
                    contentType = "text/html;charset=UTF-8";
                }
                default -> {
                    return ResponseEntity.badRequest().build();
                }
            }

            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(contentType));
            headers.setContentDispositionFormData("attachment", outName);

            return ResponseEntity.ok().headers(headers).body(data);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * POST /api/documents/export-pdf  (legacy — delegates to /export?format=pdf)
     * Kept for backward compatibility with existing frontend calls.
     */
    @PostMapping("/export-pdf")
    public ResponseEntity<byte[]> exportPdfLegacy(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestBody Map<String, Object> documentModel) {
        if (user == null) return ResponseEntity.status(401).build();
        try {
            String title = String.valueOf(documentModel.getOrDefault("title", "document"));
            byte[] data  = exportService.exportToPdf(documentModel);

            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDispositionFormData("attachment", title + ".pdf");
            return ResponseEntity.ok().headers(headers).body(data);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // HWP binary parsing (hwplib)
    // ─────────────────────────────────────────────────────────────────
    private ResponseEntity<Map<String, Object>> parseHwp(MultipartFile file) throws Exception {
        java.nio.file.Path tempPath = java.nio.file.Files.createTempFile("hc_hwp_", ".hwp");
        File temp = tempPath.toFile();
        try {
            file.transferTo(tempPath);
            HWPFile hwpFile = HWPReader.fromFile(temp.getAbsolutePath());
            if (hwpFile == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "손상된 HWP 파일입니다."));
            }

            List<Map<String, Object>> sections = new ArrayList<>();

            for (int si = 0; si < hwpFile.getBodyText().getSectionList().size(); si++) {
                Section section = hwpFile.getBodyText().getSectionList().get(si);
                List<Map<String, Object>> paragraphs = new ArrayList<>();

                for (int pi = 0; pi < section.getParagraphCount(); pi++) {
                    Paragraph para = section.getParagraph(pi);
                    Map<String, Object> paraMap = extractParagraph(hwpFile, para);
                    paragraphs.add(paraMap);
                }

                sections.add(Map.of("paragraphs", paragraphs));
            }

            Map<String, Object> model = new LinkedHashMap<>();
            model.put("title", file.getOriginalFilename());
            model.put("format", "hwp");
            model.put("fileType", "hwp");
            model.put("sectionCount", sections.size());
            model.put("sections", sections);
            model.put("fontMap", fontMappingService.getFullMap());
            return ResponseEntity.ok(model);

        } finally {
            temp.delete();
        }
    }

    /**
     * Extracts a single paragraph into a JSON-safe map.
     * Currently extracts plain text. Styling requires deep mapping of CharShape list.
     */
    private Map<String, Object> extractParagraph(HWPFile hwpFile, Paragraph para) {
        StringBuilder text = new StringBuilder();
        if (para.getText() != null) {
            for (HWPChar hwpChar : para.getText().getCharList()) {
                if (hwpChar instanceof HWPCharNormal) {
                    text.append((char) ((HWPCharNormal) hwpChar).getCode());
                }
            }
        }

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("text",      text.toString());
        map.put("fontName",  "NanumGothic");
        map.put("fontSize",  14);
        map.put("bold",      false);
        map.put("italic",    false);
        map.put("underline", false);
        map.put("align",     "left");
        return map;
    }



    /**
     * GET /api/documents/fontmap
     * Returns the complete font substitution table for use by the frontend editor.
     */
    @GetMapping("/fontmap")
    public ResponseEntity<Map<String, String>> getFontMap() {
        return ResponseEntity.ok(fontMappingService.getFullMap());
    }

}
