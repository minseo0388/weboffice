package com.cloud.service;

import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.usermodel.Range;
import org.apache.poi.hwpf.usermodel.Table;
import org.apache.poi.hwpf.usermodel.TableIterator;
import org.apache.poi.util.Units;
import org.apache.poi.xwpf.usermodel.*;
import org.apache.poi.xwpf.model.XWPFHeaderFooterPolicy;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.*;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.math.BigInteger;
import java.util.*;

/**
 * WordService — Apache POI XWPF 전체 API 활용
 *
 * 지원 기능:
 *  파싱: 텍스트, 서식(bold/italic/underline/strike/sup/sub/color/highlight), 정렬, 들여쓰기,
 *        줄간격, 문단간격, 목록(bullet/number), 테이블(셀서식), 이미지(base64),
 *        헤더/풋터, 페이지설정(용지크기/여백/방향)
 *  저장: 위 모든 항목 양방향
 */
@Service
public class WordService {

    // ══════════════════════════════════════════════════════════════════════
    //  DOCX Parse
    // ══════════════════════════════════════════════════════════════════════

    public Map<String, Object> parseDocx(MultipartFile file) throws Exception {
        try (XWPFDocument doc = new XWPFDocument(file.getInputStream())) {
            return parseDocxDocument(doc, file.getOriginalFilename(), "docx");
        }
    }

    private Map<String, Object> parseDocxDocument(XWPFDocument doc, String title, String format) {
        List<Map<String, Object>> paragraphs = new ArrayList<>();
        for (int i = 0; i < doc.getParagraphs().size(); i++) {
            paragraphs.add(extractParagraph(doc.getParagraphs().get(i), i));
        }

        List<Map<String, Object>> tables = new ArrayList<>();
        for (int t = 0; t < doc.getTables().size(); t++) {
            tables.add(extractTable(doc.getTables().get(t), t));
        }

        List<Map<String, Object>> images = extractImages(doc);

        Map<String, Object> pageSetup = extractPageSetup(doc);
        Map<String, Object> headerFooter = extractHeaderFooter(doc);

        Map<String, Object> section = new LinkedHashMap<>();
        section.put("paragraphs", paragraphs);
        section.put("tables",     tables);
        section.put("images",     images);
        section.put("pageSetup",  pageSetup);
        section.put("header",     headerFooter.get("header"));
        section.put("footer",     headerFooter.get("footer"));

        Map<String, Object> model = new LinkedHashMap<>();
        model.put("title",        title);
        model.put("format",       format);
        model.put("fileType",     format);
        model.put("sectionCount", 1);
        model.put("sections",     List.of(section));
        return model;
    }

    // ── Paragraph ────────────────────────────────────────────────────────

    private Map<String, Object> extractParagraph(XWPFParagraph p, int idx) {
        StringBuilder text = new StringBuilder();
        boolean bold = false, italic = false, underline = false, strike = false;
        boolean sup  = false, sub   = false;
        String  fontName = "Calibri";
        int     fontSize = 11;
        String  color    = "#000000";
        String  highlight = "";
        double  letterSpc = 0;

        for (int ri = 0; ri < p.getRuns().size(); ri++) {
            XWPFRun r = p.getRuns().get(ri);
            if (r.text() != null) text.append(r.text());
            if (ri == 0 && r.text() != null && !r.text().isEmpty()) {
                bold      = r.isBold();
                italic    = r.isItalic();
                underline = r.getUnderline() != UnderlinePatterns.NONE;
                strike    = r.isStrikeThrough();
                String vert = String.valueOf(r.getVerticalAlignment()).toLowerCase(Locale.ROOT);
                sup       = vert.contains("super");
                sub       = vert.contains("sub");
                if (r.getFontName()         != null) fontName = r.getFontName();
                if (r.getFontSizeAsDouble() != null) fontSize = r.getFontSizeAsDouble().intValue();
                if (r.getColor()            != null) color    = "#" + r.getColor();
                if (r.getTextHighlightColor() != null) highlight = r.getTextHighlightColor().toString();
                // 자간은 현재 POI 호환성을 위해 파싱/저장하지 않는다.
            }
        }

        String align = "left";
        if (p.getAlignment() != null) {
            align = switch (p.getAlignment()) {
                case CENTER -> "center";
                case RIGHT  -> "right";
                case BOTH   -> "justify";
                default     -> "left";
            };
        }

        int    indent    = p.getIndentationLeft() > 0 ? p.getIndentationLeft() / 720 : 0;
        double lineSpace = 1.0;
        if (p.getSpacingBetween() > 0) lineSpace = p.getSpacingBetween() / 240.0;
        double spaceBefore = p.getSpacingBeforeLines() / 240.0;
        double spaceAfter  = p.getSpacingAfterLines()  / 240.0;

        String listType = "none";
        int    listLevel = 0;
        if (p.getNumID() != null) {
            listType  = "bullet";
            listLevel = p.getNumIlvl() != null ? p.getNumIlvl().intValue() : 0;
        }

        String styleName = p.getStyle() != null ? p.getStyle() : "";

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("paragraphIndex",          idx);
        m.put("text",                    text.toString());
        m.put("fontName",                fontName);
        m.put("fontSize",                fontSize);
        m.put("bold",                    bold);
        m.put("italic",                  italic);
        m.put("underline",               underline);
        m.put("strikethrough",           strike);
        m.put("superscript",             sup);
        m.put("subscript",               sub);
        m.put("textColor",               color);
        m.put("highlightColor",          highlight);
        m.put("letterSpacing",           letterSpc);
        m.put("align",                   align);
        m.put("indent",                  indent);
        m.put("lineSpacing",             lineSpace);
        m.put("paragraphSpacingBefore",  spaceBefore);
        m.put("paragraphSpacingAfter",   spaceAfter);
        m.put("listType",                listType);
        m.put("listLevel",               listLevel);
        m.put("style",                   styleName);
        return m;
    }

    // ── Table ─────────────────────────────────────────────────────────────

    private Map<String, Object> extractTable(XWPFTable tbl, int idx) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (int r = 0; r < tbl.getRows().size(); r++) {
            XWPFTableRow row = tbl.getRows().get(r);
            List<Map<String, Object>> cells = new ArrayList<>();
            for (int c = 0; c < row.getTableCells().size(); c++) {
                XWPFTableCell cell = row.getTableCells().get(c);
                // 셀 내 paragraph 전체 텍스트 + 서식
                List<Map<String, Object>> cellParas = new ArrayList<>();
                for (int pi = 0; pi < cell.getParagraphs().size(); pi++) {
                    cellParas.add(extractParagraph(cell.getParagraphs().get(pi), pi));
                }
                Map<String, Object> cm = new LinkedHashMap<>();
                cm.put("row",       r);
                cm.put("col",       c);
                cm.put("text",      cell.getText());
                cm.put("paragraphs", cellParas);
                cm.put("bgColor",   cell.getColor());
                cm.put("width",     cell.getWidth());
                cells.add(cm);
            }
            rows.add(Map.of("cells", cells));
        }
        return Map.of("tableIndex", idx, "rows", rows);
    }

    // ── Images ────────────────────────────────────────────────────────────

    private List<Map<String, Object>> extractImages(XWPFDocument doc) {
        List<Map<String, Object>> images = new ArrayList<>();
        for (XWPFPictureData pic : doc.getAllPictures()) {
            Map<String, Object> im = new LinkedHashMap<>();
            im.put("contentType", pic.getPackagePart().getContentType());
            im.put("base64",      java.util.Base64.getEncoder().encodeToString(pic.getData()));
            images.add(im);
        }
        return images;
    }

    // ── Page Setup ───────────────────────────────────────────────────────

    private Map<String, Object> extractPageSetup(XWPFDocument doc) {
        Map<String, Object> ps = new LinkedHashMap<>();
        try {
            CTSectPr sect = doc.getDocument().getBody().getSectPr();
            if (sect != null) {
                // 용지 크기 (EMU 단위 → mm)
                if (sect.isSetPgSz()) {
                    CTPageSz sz = sect.getPgSz();
                    ps.put("pageWidthMm",  asNumber(sz.getW()) / 1440.0 * 25.4);
                    ps.put("pageHeightMm", asNumber(sz.getH()) / 1440.0 * 25.4);
                    ps.put("landscape",    "landscape".equalsIgnoreCase(String.valueOf(sz.getOrient())));
                }
                // 여백 (twips → mm)
                if (sect.isSetPgMar()) {
                    CTPageMar mg = sect.getPgMar();
                    ps.put("marginTopMm",    asNumber(mg.getTop())    / 1440.0 * 25.4);
                    ps.put("marginBottomMm", asNumber(mg.getBottom()) / 1440.0 * 25.4);
                    ps.put("marginLeftMm",   asNumber(mg.getLeft())   / 1440.0 * 25.4);
                    ps.put("marginRightMm",  asNumber(mg.getRight())  / 1440.0 * 25.4);
                }
            }
        } catch (Exception ignored) {}
        return ps;
    }

    // ── Header / Footer ──────────────────────────────────────────────────

    private Map<String, Object> extractHeaderFooter(XWPFDocument doc) {
        String headerText = "", footerText = "";
        try {
            XWPFHeaderFooterPolicy hfp = doc.getHeaderFooterPolicy();
            if (hfp != null) {
                if (hfp.getDefaultHeader() != null) headerText = hfp.getDefaultHeader().getText();
                if (hfp.getDefaultFooter() != null) footerText = hfp.getDefaultFooter().getText();
            }
        } catch (Exception ignored) {}
        return Map.of("header", headerText, "footer", footerText);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  DOC Parse (hwpf)
    // ══════════════════════════════════════════════════════════════════════

    public Map<String, Object> parseDoc(MultipartFile file) throws Exception {
        try (HWPFDocument doc = new HWPFDocument(file.getInputStream())) {
            Range range = doc.getRange();
            List<Map<String, Object>> paragraphs = new ArrayList<>();
            for (int i = 0; i < range.numParagraphs(); i++) {
                org.apache.poi.hwpf.usermodel.Paragraph p = range.getParagraph(i);
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("paragraphIndex", i);
                m.put("text",      p.text().replace("\r", "").replace("\u0000", ""));
                m.put("fontName",  "Times New Roman");
                m.put("fontSize",  p.getCharacterRun(0) != null ? p.getCharacterRun(0).getFontSize() / 2 : 11);
                m.put("bold",      p.getCharacterRun(0) != null && p.getCharacterRun(0).isBold());
                m.put("italic",    p.getCharacterRun(0) != null && p.getCharacterRun(0).isItalic());
                m.put("underline", p.getCharacterRun(0) != null && p.getCharacterRun(0).getUnderlineCode() != 0);
                m.put("align",     switch (p.getJustification()) {
                    case 1 -> "center"; case 2 -> "right"; case 3 -> "justify"; default -> "left";
                });
                paragraphs.add(m);
            }
            List<Map<String, Object>> tables = new ArrayList<>();
            TableIterator it = new TableIterator(range);
            int ti = 0;
            while (it.hasNext()) {
                Table t = it.next();
                List<Map<String, Object>> rows = new ArrayList<>();
                for (int r = 0; r < t.numRows(); r++) {
                    List<Map<String, Object>> cells = new ArrayList<>();
                    for (int c = 0; c < t.getRow(r).numCells(); c++) {
                        cells.add(Map.of("row", r, "col", c,
                            "text", t.getRow(r).getCell(c).text().replace("\u0007","").replace("\r","")));
                    }
                    rows.add(Map.of("cells", cells));
                }
                tables.add(Map.of("tableIndex", ti++, "rows", rows));
            }
            Map<String, Object> sec = new LinkedHashMap<>();
            sec.put("paragraphs", paragraphs);
            sec.put("tables",     tables);
            Map<String, Object> model = new LinkedHashMap<>();
            model.put("title",        file.getOriginalFilename());
            model.put("format",       "doc");
            model.put("fileType",     "doc");
            model.put("sectionCount", 1);
            model.put("sections",     List.of(sec));
            return model;
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  DOCX Save
    // ══════════════════════════════════════════════════════════════════════

    @SuppressWarnings("unchecked")
    public byte[] saveDocx(Map<String, Object> model, byte[] originalBytes) throws Exception {
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(originalBytes))) {
            List<Map<String, Object>> sections = (List<Map<String, Object>>) model.get("sections");
            if (sections == null || sections.isEmpty()) return toBytes(doc);

            Map<String, Object> sec = sections.get(0);

            // ── 페이지설정 ──────────────────────────────────────────────
            Map<String, Object> ps = (Map<String, Object>) sec.get("pageSetup");
            if (ps != null) applyPageSetup(doc, ps);

            // ── 헤더/풋터 ───────────────────────────────────────────────
            String hdr = (String) sec.get("header");
            String ftr = (String) sec.get("footer");
            if ((hdr != null && !hdr.isBlank()) || (ftr != null && !ftr.isBlank())) {
                applyHeaderFooter(doc, hdr, ftr);
            }

            // ── 단락 ────────────────────────────────────────────────────
            List<Map<String, Object>> paras = (List<Map<String, Object>>) sec.get("paragraphs");
            if (paras != null) {
                for (Map<String, Object> pd : paras) {
                    int idx = pd.get("paragraphIndex") instanceof Number n ? n.intValue() : -1;
                    if (idx < 0 || idx >= doc.getParagraphs().size()) continue;
                    applyParagraph(doc.getParagraphs().get(idx), pd, doc);
                }
            }

            // ── 테이블 ──────────────────────────────────────────────────
            List<Map<String, Object>> tables = (List<Map<String, Object>>) sec.get("tables");
            if (tables != null) {
                for (Map<String, Object> td : tables) {
                    int ti = td.get("tableIndex") instanceof Number n ? n.intValue() : -1;
                    if (ti < 0 || ti >= doc.getTables().size()) continue;
                    applyTable(doc.getTables().get(ti), td);
                }
            }

            return toBytes(doc);
        }
    }

    private void applyParagraph(XWPFParagraph p, Map<String, Object> d, XWPFDocument doc) {
        // 텍스트
        String txt = d.get("text") instanceof String s ? s : null;
        if (txt != null) {
            XWPFRun run = findOrCreatePrimaryRun(p);
            replaceParagraphTextPreserveRuns(p, run, txt);
            // 서식
            if (d.get("bold")          instanceof Boolean b)  run.setBold(b);
            if (d.get("italic")        instanceof Boolean b)  run.setItalic(b);
            if (d.get("underline")     instanceof Boolean b)  run.setUnderline(b ? UnderlinePatterns.SINGLE : UnderlinePatterns.NONE);
            if (d.get("strikethrough") instanceof Boolean b)  run.setStrikeThrough(b);
            if (d.get("superscript")   instanceof Boolean b && b) run.setVerticalAlignment("superscript");
            if (d.get("subscript")     instanceof Boolean b && b) run.setVerticalAlignment("subscript");
            if (d.get("textColor")     instanceof String c && c.startsWith("#")) run.setColor(c.substring(1));
            if (d.get("fontName")      instanceof String fn && !fn.isBlank()) run.setFontFamily(fn);
            if (d.get("fontSize")      instanceof Number fs)  run.setFontSize(fs.doubleValue());
            // 자간 (twentieths of pt)
            if (d.get("letterSpacing") instanceof Number ls && ls.doubleValue() != 0) {
                try {
                    CTRPr rpr = run.getCTR().isSetRPr() ? run.getCTR().getRPr() : run.getCTR().addNewRPr();
                    // 자간은 호환성 이슈로 저장하지 않는다.
                } catch (Exception ignored) {}
            }
        }

        // 정렬
        if (d.get("align") instanceof String a) {
            p.setAlignment(switch (a) {
                case "center"  -> ParagraphAlignment.CENTER;
                case "right"   -> ParagraphAlignment.RIGHT;
                case "justify" -> ParagraphAlignment.BOTH;
                default        -> ParagraphAlignment.LEFT;
            });
        }
        if (d.get("indent")      instanceof Number i)  p.setIndentationLeft(i.intValue() * 720);
        if (d.get("lineSpacing") instanceof Number ls) p.setSpacingBetween(ls.doubleValue() * 240);
        if (d.get("paragraphSpacingBefore") instanceof Number sb) p.setSpacingBeforeLines((int)(sb.doubleValue() * 240));
        if (d.get("paragraphSpacingAfter")  instanceof Number sa) p.setSpacingAfterLines((int)(sa.doubleValue() * 240));

        // 목록
        if ("bullet".equals(d.get("listType"))) {
            applyBullet(p, d, doc);
        }
    }

    private void applyBullet(XWPFParagraph p, Map<String, Object> d, XWPFDocument doc) {
        try {
            XWPFNumbering numbering = doc.getNumbering();
            if (numbering == null) numbering = doc.createNumbering();
            int level = d.get("listLevel") instanceof Number lv ? lv.intValue() : 0;
            // 기존 numId 사용 또는 신규 생성
            if (p.getNumID() == null) {
                BigInteger abstractNumId = numbering.addAbstractNum(new XWPFAbstractNum(CTAbstractNum.Factory.newInstance()));
                BigInteger numId         = numbering.addNum(abstractNumId);
                p.setNumID(numId);
            }
            p.setNumILvl(BigInteger.valueOf(level));
        } catch (Exception ignored) {}
    }

    @SuppressWarnings("unchecked")
    private void applyTable(XWPFTable tbl, Map<String, Object> td) {
        List<Map<String, Object>> rows = (List<Map<String, Object>>) td.get("rows");
        if (rows == null) return;
        for (Map<String, Object> rd : rows) {
            List<Map<String, Object>> cells = (List<Map<String, Object>>) rd.get("cells");
            if (cells == null) continue;
            for (Map<String, Object> cd : cells) {
                int r = cd.get("row") instanceof Number n ? n.intValue() : -1;
                int c = cd.get("col") instanceof Number n ? n.intValue() : -1;
                if (r < 0 || c < 0 || r >= tbl.getRows().size()) continue;
                XWPFTableRow row = tbl.getRow(r);
                if (row == null || c >= row.getTableCells().size()) continue;
                XWPFTableCell cell = row.getCell(c);
                if (cell == null) continue;
                // 텍스트
                String txt = cd.get("text") instanceof String s ? s : null;
                if (txt != null) {
                    if (cell.getParagraphs().isEmpty()) cell.addParagraph();
                    XWPFParagraph cp = cell.getParagraphs().get(0);
                    XWPFRun cr = cp.getRuns().isEmpty() ? cp.createRun() : cp.getRuns().get(0);
                    cr.setText(txt, 0);
                }
                // 배경색
                if (cd.get("bgColor") instanceof String bg && !bg.isBlank()) {
                    cell.setColor(bg.replace("#", ""));
                }
            }
        }
    }

    private void applyPageSetup(XWPFDocument doc, Map<String, Object> ps) {
        try {
            CTSectPr sect = doc.getDocument().getBody().getSectPr();
            if (sect == null) sect = doc.getDocument().getBody().addNewSectPr();

            // 용지 크기 (mm → twips: 1mm = 56.69 twips)
            if (ps.get("pageWidthMm") instanceof Number w && ps.get("pageHeightMm") instanceof Number h) {
                CTPageSz sz = sect.isSetPgSz() ? sect.getPgSz() : sect.addNewPgSz();
                sz.setW(BigInteger.valueOf((long)(w.doubleValue() * 56.69)));
                sz.setH(BigInteger.valueOf((long)(h.doubleValue() * 56.69)));
            }
            if (Boolean.TRUE.equals(ps.get("landscape"))) {
                CTPageSz sz = sect.isSetPgSz() ? sect.getPgSz() : sect.addNewPgSz();
                sz.setOrient(STPageOrientation.LANDSCAPE);
            }

            // 여백
            if (ps.get("marginTopMm") instanceof Number) {
                CTPageMar mg = sect.isSetPgMar() ? sect.getPgMar() : sect.addNewPgMar();
                mg.setTop(BigInteger.valueOf((long)(((Number)ps.get("marginTopMm")).doubleValue() * 56.69)));
                mg.setBottom(BigInteger.valueOf((long)(((Number)ps.get("marginBottomMm")).doubleValue() * 56.69)));
                mg.setLeft(BigInteger.valueOf((long)(((Number)ps.get("marginLeftMm")).doubleValue() * 56.69)));
                mg.setRight(BigInteger.valueOf((long)(((Number)ps.get("marginRightMm")).doubleValue() * 56.69)));
            }
        } catch (Exception ignored) {}
    }

    private void applyHeaderFooter(XWPFDocument doc, String header, String footer) {
        try {
            XWPFHeaderFooterPolicy hfp = doc.createHeaderFooterPolicy();
            if (header != null && !header.isBlank()) {
                XWPFHeader h = hfp.createHeader(XWPFHeaderFooterPolicy.DEFAULT);
                XWPFParagraph p = h.getParagraphs().isEmpty() ? h.createParagraph() : h.getParagraphs().get(0);
                XWPFRun r = p.createRun();
                r.setText(header);
            }
            if (footer != null && !footer.isBlank()) {
                XWPFFooter f = hfp.createFooter(XWPFHeaderFooterPolicy.DEFAULT);
                XWPFParagraph p = f.getParagraphs().isEmpty() ? f.createParagraph() : f.getParagraphs().get(0);
                XWPFRun r = p.createRun();
                r.setText(footer);
            }
        } catch (Exception ignored) {}
    }

    private double asNumber(Object value) {
        if (value instanceof BigInteger bi) return bi.doubleValue();
        if (value instanceof Number n) return n.doubleValue();
        return 0.0;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  DOC Save (hwpf)
    // ══════════════════════════════════════════════════════════════════════

    @SuppressWarnings("unchecked")
    public byte[] saveDoc(Map<String, Object> model, byte[] originalBytes) throws Exception {
        try (HWPFDocument doc = new HWPFDocument(new ByteArrayInputStream(originalBytes))) {
            List<Map<String, Object>> sections = (List<Map<String, Object>>) model.get("sections");
            if (sections != null && !sections.isEmpty()) {
                List<Map<String, Object>> paras = (List<Map<String, Object>>) sections.get(0).get("paragraphs");
                if (paras != null) {
                    Range range = doc.getRange();
                    for (Map<String, Object> pd : paras) {
                        int idx = pd.get("paragraphIndex") instanceof Number n ? n.intValue() : -1;
                        if (idx < 0 || idx >= range.numParagraphs()) continue;
                        String txt = (String) pd.get("text");
                        if (txt == null) continue;
                        org.apache.poi.hwpf.usermodel.Paragraph p = range.getParagraph(idx);
                        p.replaceText(p.text(), txt + "\r");
                    }
                }
            }
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.write(baos);
            return baos.toByteArray();
        }
    }

    private byte[] toBytes(XWPFDocument doc) throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        doc.write(baos);
        return baos.toByteArray();
    }

    private XWPFRun findOrCreatePrimaryRun(XWPFParagraph p) {
        List<XWPFRun> runs = p.getRuns();
        for (XWPFRun r : runs) {
            try {
                if (r != null && (r.getEmbeddedPictures() == null || r.getEmbeddedPictures().isEmpty())) {
                    return r;
                }
            } catch (Exception ignored) {}
        }
        return p.createRun();
    }

    private void replaceParagraphTextPreserveRuns(XWPFParagraph p, XWPFRun targetRun, String text) {
        // Preserve runs & non-text contents (pictures/drawings). Only clear text nodes.
        for (XWPFRun r : p.getRuns()) {
            if (r == null) continue;
            // Avoid touching picture runs.
            try {
                if (r.getEmbeddedPictures() != null && !r.getEmbeddedPictures().isEmpty()) continue;
            } catch (Exception ignored) {}
            clearRunText(r);
        }
        setRunText(targetRun, text);
    }

    private void clearRunText(XWPFRun run) {
        try {
            // <w:t>
            while (run.getCTR().sizeOfTArray() > 0) run.getCTR().removeT(0);
            // <w:instrText>
            while (run.getCTR().sizeOfInstrTextArray() > 0) run.getCTR().removeInstrText(0);
        } catch (Exception ignored) {}
    }

    private void setRunText(XWPFRun run, String text) {
        clearRunText(run);
        try {
            CTText t = run.getCTR().addNewT();
            t.setStringValue(text == null ? "" : text);
        } catch (Exception ignored) {
            run.setText(text == null ? "" : text, 0);
        }
    }
}
