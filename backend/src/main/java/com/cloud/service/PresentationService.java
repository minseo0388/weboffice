package com.cloud.service;

import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import java.awt.Color;
import org.apache.poi.xslf.usermodel.*;
import org.apache.poi.sl.usermodel.PictureData;
import org.apache.poi.sl.usermodel.ShapeType;
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
                Map<String, Object> shapeData = extractShape(shape);
                if (shapeData != null) {
                    shapes.add(shapeData);
                }
            }
            
            slideData.put("isHidden", slide.isHidden());
            
            XSLFNotes notes = slide.getNotes();
            if (notes != null) {
                StringBuilder notesText = new StringBuilder();
                for (XSLFShape shape : notes.getShapes()) {
                    if (shape instanceof XSLFTextShape) {
                        notesText.append(((XSLFTextShape) shape).getText()).append("\n");
                    }
                }
                slideData.put("notes", notesText.toString().trim());
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
    private Map<String, Object> extractShape(XSLFShape shape) {
        if (shape instanceof XSLFPictureShape pictureShape) {
            return extractImageShape(pictureShape);
        }

        if (shape instanceof XSLFTextShape textShape) {
            return extractTextOrAutoShape(textShape);
        }

        return null;
    }

    private Map<String, Object> extractImageShape(XSLFPictureShape pictureShape) {
        Map<String, Object> shapeData = new LinkedHashMap<>();
        shapeData.put("type", "image");
        shapeData.put("text", "");

        java.awt.geom.Rectangle2D anchor = pictureShape.getAnchor();
        shapeData.put("x", (int) anchor.getX());
        shapeData.put("y", (int) anchor.getY());
        shapeData.put("width", (int) anchor.getWidth());
        shapeData.put("height", (int) anchor.getHeight());
        shapeData.put("imageFit", "cover");

        Map<String, Object> formatting = new LinkedHashMap<>();
        formatting.put("fontName", "Calibri");
        formatting.put("fontSize", 18);
        formatting.put("align", "center");
        shapeData.put("formatting", formatting);

        XSLFPictureData pictureData = pictureShape.getPictureData();
        if (pictureData != null) {
            String mime = pictureData.getContentType();
            byte[] bytes = pictureData.getData();
            if (mime != null && bytes != null) {
                String base64 = Base64.getEncoder().encodeToString(bytes);
                shapeData.put("imageUrl", "data:" + mime + ";base64," + base64);
            }
        }

        return shapeData;
    }

    private Map<String, Object> extractTextOrAutoShape(XSLFTextShape textShape) {
        Map<String, Object> shapeData = new LinkedHashMap<>();
        String type = "text";
        if (textShape instanceof XSLFAutoShape autoShape) {
            type = mapFromPoiShapeType(autoShape.getShapeType());
            if ("rect".equals(type) && autoShape.getFillColor() == null && autoShape.getLineColor() == null) {
                type = "text";
            }
            if (autoShape.getFillColor() != null) {
                shapeData.put("backgroundColor", colorToHex(autoShape.getFillColor()));
            }
            if (autoShape.getLineColor() != null) {
                shapeData.put("borderColor", colorToHex(autoShape.getLineColor()));
            }
            if (autoShape.getLineWidth() > 0) {
                shapeData.put("borderWidth", Math.max(0, (int) Math.round(autoShape.getLineWidth())));
            }
        }
        shapeData.put("type", type);
        
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
                // run.getFontColor() returns PaintStyle in POI; parsing exact color is optional here.
                
                String fontName = run.getFontFamily();
                formatting.put("fontName", fontName != null ? fontName : "Calibri");
            }

            if (para.getTextAlign() != null) {
                formatting.put("align", switch (para.getTextAlign()) {
                    case CENTER -> "center";
                    case RIGHT -> "right";
                    case JUSTIFY, JUSTIFY_LOW -> "justify";
                    default -> "left";
                });
            }
            formatting.put("bullet", para.isBullet());
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
            // Remove extra slides
            while (slideShow.getSlides().size() > slides.size()) {
                slideShow.removeSlide(slideShow.getSlides().size() - 1);
            }
            
            // Add missing slides
            while (slideShow.getSlides().size() < slides.size()) {
                slideShow.createSlide();
            }

            // Update all slides
            int slideIndex = 0;
            for (XSLFSlide slide : slideShow.getSlides()) {
                Map<String, Object> slideData = slides.get(slideIndex);
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> shapes = (List<Map<String, Object>>) slideData.get("shapes");
                
                if (shapes != null) {
                    // Remove existing shapes safely by clearing the slide
                    // Wait, clearing the slide removes all content. Let's just create a new list of text shapes to keep and remove the rest.
                    List<XSLFShape> existingShapes = new ArrayList<>(slide.getShapes());
                    for (XSLFShape shape : existingShapes) {
                        slide.removeShape(shape);
                    }

                    // Re-create all shapes based on the JSON model
                    for (Map<String, Object> shapeData : shapes) {
                        String type = (String) shapeData.getOrDefault("type", "text");
                        Number x = (Number) shapeData.get("x");
                        Number y = (Number) shapeData.get("y");
                        Number w = (Number) shapeData.get("width");
                        Number h = (Number) shapeData.get("height");

                        java.awt.geom.Rectangle2D.Double anchor = null;
                        if (x != null && y != null && w != null && h != null) {
                            anchor = new java.awt.geom.Rectangle2D.Double(
                                x.doubleValue(), y.doubleValue(), w.doubleValue(), h.doubleValue()
                            );
                        }

                        if ("image".equals(type)) {
                            String imageUrl = (String) shapeData.get("imageUrl");
                            if (imageUrl != null && !imageUrl.isBlank()) {
                                byte[] imageBytes = resolveImageBytes(imageUrl);
                                PictureData.PictureType pictureType = resolvePictureType(imageUrl);
                                XSLFPictureData pictureData = slideShow.addPicture(imageBytes, pictureType);
                                XSLFPictureShape pictureShape = slide.createPicture(pictureData);
                                if (anchor != null) {
                                    pictureShape.setAnchor(anchor);
                                }
                            }
                            continue;
                        }

                        XSLFAutoShape autoShape = slide.createAutoShape();
                        autoShape.setShapeType(mapToPoiShapeType(type));

                        if ("text".equals(type)) {
                            autoShape.setFillColor(null);
                            autoShape.setLineColor(null);
                        } else {
                            String backgroundColor = (String) shapeData.get("backgroundColor");
                            String borderColor = (String) shapeData.get("borderColor");
                            Number borderWidth = (Number) shapeData.get("borderWidth");

                            if (backgroundColor != null) {
                                autoShape.setFillColor(parseHexColor(backgroundColor));
                            }
                            if (borderColor != null) {
                                autoShape.setLineColor(parseHexColor(borderColor));
                            }
                            if (borderWidth != null) {
                                autoShape.setLineWidth(borderWidth.doubleValue());
                            }
                        }

                        updateTextShape(autoShape, shapeData);

                        // Set position and size
                        if (anchor != null) {
                            autoShape.setAnchor(anchor);
                        }
                    }
                }
                
                Boolean isHidden = (Boolean) slideData.get("isHidden");
                if (isHidden != null) {
                    slide.setHidden(isHidden);
                }
                
                String notesText = (String) slideData.get("notes");
                if (notesText != null && !notesText.isEmpty()) {
                    XSLFNotes notes = slide.getNotes();
                    if (notes == null) {
                        // POI doesn't easily support creating notes from scratch if they don't exist, 
                        // but we can try slideShow.getNotesMaster() or just skip if null for this basic implementation.
                    } else {
                        // Clear and set notes
                        for (XSLFShape shape : notes.getShapes()) {
                            if (shape instanceof XSLFTextShape) {
                                ((XSLFTextShape) shape).setText(notesText);
                                break;
                            }
                        }
                    }
                }
                
                slideIndex++;
            }
        }
        
        java.io.ByteArrayOutputStream outputStream = new java.io.ByteArrayOutputStream();
        slideShow.write(outputStream);
        slideShow.close();
        
        return outputStream.toByteArray();
    }

    private void updateTextShape(XSLFTextShape textShape, Map<String, Object> shapeData) {
        String newText = (String) shapeData.get("text");
        @SuppressWarnings("unchecked")
        Map<String, Object> formatting = (Map<String, Object>) shapeData.get("formatting");
        
        if (newText != null) {
            textShape.clearText();
            XSLFTextParagraph paragraph = textShape.addNewTextParagraph();
            XSLFTextRun run = paragraph.addNewTextRun();
            run.setText(newText);
            
            if (formatting != null) {
                // Text Alignment
                if (formatting.containsKey("align")) {
                    String align = (String) formatting.get("align");
                    if ("center".equals(align)) paragraph.setTextAlign(org.apache.poi.sl.usermodel.TextParagraph.TextAlign.CENTER);
                    else if ("right".equals(align)) paragraph.setTextAlign(org.apache.poi.sl.usermodel.TextParagraph.TextAlign.RIGHT);
                    else if ("justify".equals(align)) paragraph.setTextAlign(org.apache.poi.sl.usermodel.TextParagraph.TextAlign.JUSTIFY);
                    else paragraph.setTextAlign(org.apache.poi.sl.usermodel.TextParagraph.TextAlign.LEFT);
                }
                
                // Bullet points
                if (formatting.containsKey("bullet")) {
                    paragraph.setBullet((Boolean) formatting.get("bullet"));
                }
                
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
                if (formatting.containsKey("color")) {
                    String colorHex = (String) formatting.get("color");
                    if (colorHex != null) {
                        run.setFontColor(parseHexColor(colorHex));
                    }
                }
            }
        }
    }

    private ShapeType mapToPoiShapeType(String type) {
        return switch (type) {
            case "rect" -> ShapeType.RECT;
            case "ellipse" -> ShapeType.ELLIPSE;
            case "triangle" -> ShapeType.TRIANGLE;
            case "right_arrow" -> ShapeType.RIGHT_ARROW;
            case "hexagon" -> ShapeType.HEXAGON;
            case "star" -> ShapeType.STAR_5;
            case "round_rect" -> ShapeType.ROUND_RECT;
            default -> ShapeType.RECT;
        };
    }

    private String mapFromPoiShapeType(ShapeType shapeType) {
        if (shapeType == null) return "text";
        return switch (shapeType) {
            case RECT -> "rect";
            case ELLIPSE -> "ellipse";
            case TRIANGLE -> "triangle";
            case RIGHT_ARROW -> "right_arrow";
            case HEXAGON -> "hexagon";
            case STAR_5 -> "star";
            case ROUND_RECT -> "round_rect";
            default -> "text";
        };
    }

    private Color parseHexColor(String hex) {
        if (hex == null || hex.isBlank()) {
            return Color.BLACK;
        }
        String value = hex.startsWith("#") ? hex.substring(1) : hex;
        if (value.length() == 3) {
            value = "" + value.charAt(0) + value.charAt(0)
                    + value.charAt(1) + value.charAt(1)
                    + value.charAt(2) + value.charAt(2);
        }
        try {
            int rgb = Integer.parseInt(value, 16);
            return new Color(rgb);
        } catch (Exception e) {
            return Color.BLACK;
        }
    }

    private String colorToHex(Color color) {
        if (color == null) return "#000000";
        return String.format("#%02x%02x%02x", color.getRed(), color.getGreen(), color.getBlue());
    }

    private byte[] resolveImageBytes(String imageUrl) throws Exception {
        if (imageUrl.startsWith("data:")) {
            int commaIdx = imageUrl.indexOf(',');
            if (commaIdx < 0) {
                throw new IllegalArgumentException("Invalid data URL image payload");
            }
            String meta = imageUrl.substring(0, commaIdx);
            String dataPart = imageUrl.substring(commaIdx + 1);
            if (meta.contains(";base64")) {
                return Base64.getDecoder().decode(dataPart);
            }
            return java.net.URLDecoder.decode(dataPart, StandardCharsets.UTF_8).getBytes(StandardCharsets.UTF_8);
        }

        try (InputStream remoteIn = URI.create(imageUrl).toURL().openStream()) {
            return remoteIn.readAllBytes();
        }
    }

    private PictureData.PictureType resolvePictureType(String imageUrl) {
        String lower = imageUrl.toLowerCase(Locale.ROOT);

        Pattern mimePattern = Pattern.compile("^data:([^;]+);base64,", Pattern.CASE_INSENSITIVE);
        Matcher matcher = mimePattern.matcher(imageUrl);
        if (matcher.find()) {
            String mime = matcher.group(1).toLowerCase(Locale.ROOT);
            if (mime.contains("png")) return PictureData.PictureType.PNG;
            if (mime.contains("jpeg") || mime.contains("jpg")) return PictureData.PictureType.JPEG;
            if (mime.contains("gif")) return PictureData.PictureType.GIF;
            if (mime.contains("bmp")) return PictureData.PictureType.BMP;
            if (mime.contains("tiff")) return PictureData.PictureType.TIFF;
            if (mime.contains("webp")) return PictureData.PictureType.PNG;
        }

        if (lower.contains(".png")) return PictureData.PictureType.PNG;
        if (lower.contains(".jpg") || lower.contains(".jpeg")) return PictureData.PictureType.JPEG;
        if (lower.contains(".gif")) return PictureData.PictureType.GIF;
        if (lower.contains(".bmp")) return PictureData.PictureType.BMP;
        if (lower.contains(".tif") || lower.contains(".tiff")) return PictureData.PictureType.TIFF;
        return PictureData.PictureType.PNG;
    }
}
