package com.cloud.controller;

import com.cloud.service.FontMappingService;
import kr.dogfoot.hwplib.object.HWPFile;
import kr.dogfoot.hwplib.object.bodytext.Section;
import kr.dogfoot.hwplib.object.bodytext.paragraph.Paragraph;
import kr.dogfoot.hwplib.object.bodytext.paragraph.text.HWPChar;
import kr.dogfoot.hwplib.object.bodytext.paragraph.text.HWPCharNormal;
import kr.dogfoot.hwplib.reader.HWPReader;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
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

    public DocumentController(FontMappingService fontMappingService) {
        this.fontMappingService = fontMappingService;
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
                return parseHwp(file);
            } else if (lower.endsWith(".hwpx")) {
                return parseHwpx(file);
            } else {
                return ResponseEntity.badRequest().body(
                        Map.of("error", "지원하지 않는 형식입니다. HWP 또는 HWPX만 가능합니다.")
                );
            }
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(
                    Map.of("error", "파싱 실패: " + e.getMessage())
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
    // Note: hwpxlib dependency must be added to build.gradle separately
    // ─────────────────────────────────────────────────────────────────
    private ResponseEntity<Map<String, Object>> parseHwpx(MultipartFile file) throws Exception {
        // HWPX is a ZIP archive of XML. For now we return a structured placeholder
        // that the editor can display, while the full hwpxlib integration is in progress.
        // TODO: integrate kr.dogfoot.hwpxlib.reader.HWPXReader when adding hwpxlib JAR
        Map<String, Object> model = new LinkedHashMap<>();
        model.put("title", file.getOriginalFilename());
        model.put("sectionCount", 1);
        model.put("format", "hwpx");
        model.put("note", "HWPX 지원은 hwpxlib 통합 진행 중입니다.");
        model.put("sections", List.of(
                Map.of("paragraphs", List.of(
                        Map.of(
                                "text", "HWPX 파일이 업로드됐습니다. 전체 렌더링은 hwpxlib 통합 후 지원됩니다.",
                                "fontName", "NanumGothic",
                                "fontSize", 14,
                                "bold", false,
                                "italic", false,
                                "underline", false,
                                "align", "left"
                        )
                ))
        ));
        return ResponseEntity.ok(model);
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
