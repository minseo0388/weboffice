package com.cloud.controller;

import com.cloud.model.UserPrincipal;
import com.cloud.service.DocumentSaveService;
import com.cloud.service.DocumentServiceFactory;
import com.cloud.service.FontMappingService;
import com.cloud.service.StorageService;
import kr.dogfoot.hwplib.object.HWPFile;
import kr.dogfoot.hwplib.object.bodytext.Section;
import kr.dogfoot.hwplib.object.bodytext.paragraph.Paragraph;
import kr.dogfoot.hwplib.object.bodytext.paragraph.text.HWPChar;
import kr.dogfoot.hwplib.object.bodytext.paragraph.text.HWPCharNormal;
import kr.dogfoot.hwplib.reader.HWPReader;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.FileInputStream;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

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
    private final DocumentSaveService documentSaveService;

    @Autowired
    public DocumentController(
            FontMappingService fontMappingService,
            DocumentServiceFactory documentServiceFactory,
            StorageService storageService,
            DocumentSaveService documentSaveService
    ) {
        this.fontMappingService = fontMappingService;
        this.documentServiceFactory = documentServiceFactory;
        this.storageService = storageService;
        this.documentSaveService = documentSaveService;
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
            // Route to format-specific parser
            if (lower.endsWith(".hwp")) {
                return parseHwp(file);
            } else if (lower.endsWith(".hwpx")) {
                return parseHwpx(file);
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

                    if ("hwp".equals(format) || "hwpx".equals(format)) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> sections = (List<Map<String, Object>>) documentModel.get("sections");
                    if (sections == null) {
                        return ResponseEntity.badRequest().body(Map.of("error", "documentModel.sections is required for HWP/HWPX"));
                    }

                    DocumentSaveService.DocumentSaveRequest saveRequest =
                        new DocumentSaveService.DocumentSaveRequest(fileName, sections);
                    DocumentSaveService.DocumentSaveResponse legacyResponse = documentSaveService.saveDocument(user, saveRequest);

                    return ResponseEntity.ok(Map.of(
                        "success", legacyResponse.success(),
                        "fileName", legacyResponse.fileName(),
                        "fileType", format,
                        "message", legacyResponse.message(),
                        "savedBytes", legacyResponse.savedBytes()
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

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(
                    Map.of("error", "Save failed: " + e.getMessage())
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // HWP binary parsing (hwplib)
    // ─────────────────────────────────────────────────────────────────
    private ResponseEntity<Map<String, Object>> parseHwp(MultipartFile file) throws Exception {
        File temp = File.createTempFile("hc_hwp_", ".hwp");
        try {
            file.transferTo(temp);
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

    // ─────────────────────────────────────────────────────────────────
    // HWPX XML parsing (hwpxlib — neolord0)
    // Note: hwpxlib dependency added to build.gradle
    // HWPX is a ZIP container with XML files inside (document.xml, styles.xml, etc.)
    // ─────────────────────────────────────────────────────────────────
    private ResponseEntity<Map<String, Object>> parseHwpx(MultipartFile file) throws Exception {
        File temp = File.createTempFile("hc_hwpx_", ".hwpx");
        try {
            file.transferTo(temp);

            /**
             * HWPX Structure:
             * - META-INF/
             * - Contents/
             *   - content.xml (main document content)
             *   - styles.xml
             *   - etc.
             * 
             * For now, we extract text from content.xml as a baseline.
             * Full hwpxlib integration will provide complete formatting in Phase 2.
             */
            Map<String, Object> model = new LinkedHashMap<>();
            model.put("title", file.getOriginalFilename());
            model.put("format", "hwpx");
            model.put("fileType", "hwpx");

            List<Map<String, Object>> sections = new ArrayList<>();
            List<Map<String, Object>> paragraphs = new ArrayList<>();

            try (ZipInputStream zis = new ZipInputStream(new java.io.FileInputStream(temp))) {
                ZipEntry entry;
                StringBuilder extractedText = new StringBuilder();

                while ((entry = zis.getNextEntry()) != null) {
                    if (entry.getName().equals("Contents/content.xml")) {
                        byte[] buffer = new byte[8192];
                        int length;
                        while ((length = zis.read(buffer)) != -1) {
                            extractedText.append(new String(buffer, 0, length, "UTF-8"));
                        }
                        break;  // content.xml found, exit loop
                    }
                }

                if (extractedText.length() > 0) {
                    // Extract text from XML (simplified: remove XML tags)
                    String text = extractedText.toString()
                            .replaceAll("<[^>]+>", "")  // Remove all XML tags
                            .replaceAll("\\s+", " ")    // Normalize whitespace
                            .trim();

                    if (!text.isEmpty()) {
                        paragraphs.add(Map.of(
                                "text", text,
                                "fontName", "NanumGothic",
                                "fontSize", 14,
                                "bold", false,
                                "italic", false,
                                "underline", false,
                                "align", "left"
                        ));
                    }
                }
            }

            if (paragraphs.isEmpty()) {
                paragraphs.add(Map.of(
                        "text", "HWPX 파일이 업로드됐습니다. 형식 파싱 준비 중입니다.",
                        "fontName", "NanumGothic",
                        "fontSize", 14,
                        "bold", false,
                        "italic", false,
                        "underline", false,
                        "align", "left"
                ));
            }

            sections.add(Map.of("paragraphs", paragraphs));

            model.put("sectionCount", sections.size());
            model.put("sections", sections);
            model.put("fontMap", fontMappingService.getFullMap());
            model.put("note", "HWPX 파일은 기본 텍스트 추출만 지원합니다. 전체 형식 지원은 Q2에 예정되어 있습니다.");

            return ResponseEntity.ok(model);

        } finally {
            temp.delete();
        }
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
