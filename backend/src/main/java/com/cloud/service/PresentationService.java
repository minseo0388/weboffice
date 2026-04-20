package com.cloud.service;

import java.io.InputStream;
import java.util.*;
import org.apache.poi.xslf.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * PresentationService: Parses and saves PPTX files using Apache POI XSLF.
 * 
 * Converts PowerPoint presentations into a unified JSON model:
 * {
 *   "title": "presentation.pptx",
 *   "format": "pptx",
 *   "slides": [
 *     {
 *       "slideNumber": 1,
 *       "shapes": [
 *         {
 *           "type": "text",
 *           "text": "Hello World",
 *           "x": 100, "y": 100, "width": 500, "height": 100,
 *           "formatting": { "bold": false, "fontSize": 44, ... }
 *         }
 *       ]
 *     }
 *   ]
 * }
 */
@Service
public class PresentationService {

    /**
     * Parse PPTX file and extract slide data into unified JSON model.
     */
    public Map<String, Object> parsePptx(MultipartFile file) throws Exception {
        InputStream inputStream = file.getInputStream();
        XMLSlideShow slideShow = new XMLSlideShow(inputStream);
        
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("title", file.getOriginalFilename());
        result.put("format", "pptx");
        
        List<Map<String, Object>> slides = new ArrayList<>();
        
        int slideIndex = 1;
        for (XSLFSlide slide : slideShow.getSlides()) {
            Map<String, Object> slideData = new LinkedHashMap<>();
            slideData.put("slideNumber", slideIndex);
            
            List<Map<String, Object>> shapes = new ArrayList<>();
            
            for (XSLFShape shape : slide.getShapes()) {
                if (shape instanceof XSLFTextShape) {
                    XSLFTextShape textShape = (XSLFTextShape) shape;
                    Map<String, Object> shapeData = extractTextShape(textShape);
                    shapes.add(shapeData);
                }
            }
            
            slideData.put("shapes", shapes);
            slides.add(slideData);
            slideIndex++;
        }
        
        result.put("slides", slides);
        inputStream.close();
        slideShow.close();
        
        return result;
    }

    /**
     * Extract text and formatting from a text shape.
     */
    private Map<String, Object> extractTextShape(XSLFTextShape textShape) {
        Map<String, Object> shapeData = new LinkedHashMap<>();
        shapeData.put("type", "text");
        
        StringBuilder fullText = new StringBuilder();
        for (XSLFTextParagraph paragraph : textShape.getTextParagraphs()) {
            for (XSLFTextRun run : paragraph.getTextRuns()) {
                fullText.append(run.getRawText());
            }
        }
        
        shapeData.put("text", fullText.toString());
        
        // Position and dimensions
        java.awt.geom.Rectangle2D anchor = textShape.getAnchor();
        shapeData.put("x", (int) anchor.getX());
        shapeData.put("y", (int) anchor.getY());
        shapeData.put("width", (int) anchor.getWidth());
        shapeData.put("height", (int) anchor.getHeight());
        
        // Formatting (from first run as baseline)
        Map<String, Object> formatting = new LinkedHashMap<>();
        if (!textShape.getTextParagraphs().isEmpty()) {
            XSLFTextParagraph para = textShape.getTextParagraphs().get(0);
            if (!para.getTextRuns().isEmpty()) {
                XSLFTextRun run = para.getTextRuns().get(0);
                
                formatting.put("bold", run.isBold());
                formatting.put("italic", run.isItalic());
                formatting.put("underline", run.isUnderlined());
                formatting.put("fontSize", run.getFontSize());
                
                String fontName = run.getFontFamily();
                formatting.put("fontName", fontName != null ? fontName : "Calibri");
            }
        }
        
        shapeData.put("formatting", formatting);
        return shapeData;
    }

    /**
     * Save presentation updates back to PPTX binary.
     * 
     * Note: Full-featured save requires re-creating the presentation or using
     * more advanced POI techniques. This is a basic implementation that modifies
     * text content in existing shapes.
     */
    public byte[] savePptx(Map<String, Object> model, byte[] originalPptxBytes) throws Exception {
        InputStream inputStream = new java.io.ByteArrayInputStream(originalPptxBytes);
        XMLSlideShow slideShow = new XMLSlideShow(inputStream);
        
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> slides = (List<Map<String, Object>>) model.get("slides");
        
        if (slides != null) {
            int slideIndex = 0;
            for (XSLFSlide slide : slideShow.getSlides()) {
                if (slideIndex >= slides.size()) break;
                
                Map<String, Object> slideData = slides.get(slideIndex);
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> shapes = (List<Map<String, Object>>) slideData.get("shapes");
                
                if (shapes != null) {
                    int shapeIndex = 0;
                    for (XSLFShape shape : slide.getShapes()) {
                        if (shapeIndex >= shapes.size()) break;
                        if (shape instanceof XSLFTextShape) {
                            XSLFTextShape textShape = (XSLFTextShape) shape;
                            Map<String, Object> shapeData = shapes.get(shapeIndex);
                            updateTextShape(textShape, shapeData);
                        }
                        shapeIndex++;
                    }
                }
                
                slideIndex++;
            }
        }
        
        // Write to byte array
        java.io.ByteArrayOutputStream outputStream = new java.io.ByteArrayOutputStream();
        slideShow.write(outputStream);
        slideShow.close();
        
        return outputStream.toByteArray();
    }

    /**
     * Update text content and basic formatting in a shape.
     */
    private void updateTextShape(XSLFTextShape textShape, Map<String, Object> shapeData) {
        String newText = (String) shapeData.get("text");
        @SuppressWarnings("unchecked")
        Map<String, Object> formatting = (Map<String, Object>) shapeData.get("formatting");
        
        if (newText != null) {
            // Clear existing text
            while (textShape.getTextParagraphs().size() > 1) {
                textShape.removeTextParagraph(textShape.getTextParagraphs().get(1));
            }
            
            XSLFTextParagraph paragraph = textShape.getTextParagraphs().get(0);
                   // Clear existing text runs
            
                   // Remove all text runs from the paragraph
                   java.util.List<XSLFTextRun> runs = new java.util.ArrayList<>(paragraph.getTextRuns());
                   for (XSLFTextRun run : runs) {
                       paragraph.removeTextRun(run);
                   }
            XSLFTextRun run = paragraph.addNewTextRun();
            run.setText(newText);
            
            // Apply formatting if provided
            if (formatting != null) {
                if (formatting.containsKey("bold")) {
                    run.setBold((Boolean) formatting.get("bold"));
                }
                if (formatting.containsKey("italic")) {
                    run.setItalic((Boolean) formatting.get("italic"));
                }
                if (formatting.containsKey("underline")) {
                    run.setUnderlined((Boolean) formatting.get("underline"));
                }
                if (formatting.containsKey("fontSize")) {
                    run.setFontSize(((Number) formatting.get("fontSize")).doubleValue());
                }
                if (formatting.containsKey("fontName")) {
                    run.setFontFamily((String) formatting.get("fontName"));
                }
            }
        }
    }
}
