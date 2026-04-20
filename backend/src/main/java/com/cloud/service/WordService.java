package com.cloud.service;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
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
        File temp = File.createTempFile("hc_docx_", ".docx");
        try {
            file.transferTo(temp);

            XWPFDocument doc = new XWPFDocument(new java.io.FileInputStream(temp));
            List<Map<String, Object>> sections = new ArrayList<>();
            List<Map<String, Object>> paragraphs = new ArrayList<>();

            // DOCX doesn't have explicit "sections" like HWP, so we treat it as one section
            for (XWPFParagraph para : doc.getParagraphs()) {
                Map<String, Object> paraMap = extractDocxParagraph(para);
                if (paraMap != null) {
                    paragraphs.add(paraMap);
                }
            }

            sections.add(Map.of("paragraphs", paragraphs));

            doc.close();

            Map<String, Object> model = new LinkedHashMap<>();
            model.put("title", file.getOriginalFilename());
            model.put("format", "docx");
            model.put("sectionCount", 1);
            model.put("sections", sections);
            model.put("note", "DOCX files are fully supported via Apache POI.");

            return model;

        } finally {
            temp.delete();
        }
    }

    /**
     * Extracts a single DOCX paragraph with basic formatting.
     */
    private Map<String, Object> extractDocxParagraph(XWPFParagraph para) {
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
            text.append(run.text());

            // Get formatting from first non-empty run
            if (runCount == 0 && run.text().length() > 0) {
                bold = run.isBold();
                italic = run.isItalic();
                underline = run.getUnderline() != null;

                if (run.getFontName() != null) {
                    fontName = run.getFontName();
                }

                if (run.getFontSizeAsDouble() != null) {
                    fontSize = (int) (run.getFontSizeAsDouble() / 2); // POI uses half-points
                }
            }

            runCount++;
        }

        // Get paragraph alignment
        String paraAlign = para.getAlignment() != null ? para.getAlignment().toString().toLowerCase() : "left";
        align = paraAlign.equals("center") ? "center" : 
                paraAlign.equals("right") ? "right" : 
                paraAlign.equals("both") ? "justify" : "left";

        String textContent = text.toString().trim();
        if (textContent.isEmpty()) {
            return null;  // Skip empty paragraphs
        }

        return Map.of(
                "text", textContent,
                "fontName", fontName,
                "fontSize", fontSize,
                "bold", bold,
                "italic", italic,
                "underline", underline,
                "align", align
        );
    }

    /**
     * Saves edited JSON model back to a DOCX file.
     * 
     * Similar to HWP, we:
     * 1. Load the original DOCX
     * 2. Update paragraph text
     * 3. Write back to binary
     */
    public void saveDocx(Map<String, Object> model, String outputPath) throws Exception {
        // For Phase 2: basic text-only update
        // Full formatting preservation (bold, italic, font) will be in Phase 3
        
        XWPFDocument doc = new XWPFDocument();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> sections = (List<Map<String, Object>>) model.get("sections");

        if (sections != null && !sections.isEmpty()) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> paragraphs = (List<Map<String, Object>>) sections.get(0).get("paragraphs");

            if (paragraphs != null) {
                for (Map<String, Object> paraData : paragraphs) {
                    String text = (String) paraData.get("text");
                    if (text != null && !text.isEmpty()) {
                        XWPFParagraph para = doc.createParagraph();
                        XWPFRun run = para.createRun();
                        run.setText(text);

                        // Apply basic formatting if available
                        Boolean bold = (Boolean) paraData.get("bold");
                        Boolean italic = (Boolean) paraData.get("italic");
                        Boolean underline = (Boolean) paraData.get("underline");
                        Integer fontSize = (Integer) paraData.get("fontSize");
                        String fontName = (String) paraData.get("fontName");

                        if (bold != null) run.setBold(bold);
                        if (italic != null) run.setItalic(italic);
                        if (underline != null && underline) run.setUnderline(org.apache.poi.xwpf.usermodel.UnderlinePatterns.SINGLE);
                        if (fontSize != null) run.setFontSize(fontSize * 2);  // POI uses half-points
                        if (fontName != null) run.setFontFamily(fontName);
                    }
                }
            }
        }

        try (java.io.FileOutputStream fos = new java.io.FileOutputStream(outputPath)) {
            doc.write(fos);
        }
        doc.close();
    }
}
