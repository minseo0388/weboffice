package com.cloud.service;

import kr.dogfoot.hwplib.object.bodytext.control.Control;
import kr.dogfoot.hwplib.object.bodytext.control.ControlType;
import kr.dogfoot.hwplib.object.bodytext.control.ControlTable;
import kr.dogfoot.hwplib.object.bodytext.control.gso.ControlPicture;
import kr.dogfoot.hwplib.object.bodytext.control.ControlSectionDefine;
import kr.dogfoot.hwplib.object.bodytext.control.table.Row;
import kr.dogfoot.hwplib.object.bodytext.control.table.Cell;
import kr.dogfoot.hwplib.object.bodytext.control.gso.GsoControl;
import kr.dogfoot.hwplib.object.bodytext.control.gso.GsoControlType;
import kr.dogfoot.hwplib.object.bodytext.control.sectiondefine.PageDef;
import kr.dogfoot.hwplib.object.HWPFile;
import kr.dogfoot.hwplib.object.bodytext.Section;
import kr.dogfoot.hwplib.object.bodytext.paragraph.Paragraph;
import kr.dogfoot.hwplib.object.bodytext.paragraph.charshape.ParaCharShape;
import kr.dogfoot.hwplib.object.bodytext.paragraph.text.HWPChar;
import kr.dogfoot.hwplib.object.bodytext.paragraph.text.HWPCharNormal;
import kr.dogfoot.hwplib.object.bodytext.paragraph.text.ParaText;
import kr.dogfoot.hwplib.object.docinfo.BorderFill;
import kr.dogfoot.hwplib.object.docinfo.CharShape;
import kr.dogfoot.hwplib.object.docinfo.Bullet;
import kr.dogfoot.hwplib.object.docinfo.DocInfo;
import kr.dogfoot.hwplib.object.docinfo.FaceName;
import kr.dogfoot.hwplib.object.docinfo.ParaShape;
import kr.dogfoot.hwplib.object.docinfo.Numbering;
import kr.dogfoot.hwplib.object.docinfo.Style;
import kr.dogfoot.hwplib.object.docinfo.charshape.UnderLineSort;
import kr.dogfoot.hwplib.object.docinfo.parashape.Alignment;
import kr.dogfoot.hwplib.reader.HWPReader;
import kr.dogfoot.hwplib.writer.HWPWriter;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;

/**
 * HwpService — hwplib을 사용한 HWP 바이너리 파일 읽기/저장
 *
 * hwplib API 요약:
 *   HWPFile.getDocInfo().getCharShapeList() — 문자 서식 목록
 *   HWPFile.getDocInfo().getParaShapeList() — 문단 서식 목록
 *   HWPFile.getDocInfo().getHangulFaceNameList() — 한글 폰트 목록
 *   CharShape.getProperty().setBold/setItalic/setSuperScript/setSubScript/setStrikeLine(boolean)
 *   CharShape.getProperty().setUnderLineSort(UnderLineSort.Bottom or None)
 *   CharShape.setBaseSize(pt * 100)
 *   CharShape.getCharColor().setR/G/B(short)
 *   CharShape.getFaceNameIds().setForAll(int fontIdx)
 *   CharShape.getCharSpaces().setForAll(byte)     — 자간
 *   CharShape.getRatios().setForAll(byte)         — 장평
 *   ParaShape.getProperty1().setAlignment(Alignment.Left/Center/Right/Justify)
 *   ParaShape.setLineSpace(int 퍼센트)
 *   ParaShape.setTopParaSpace / setBottomParaSpace
 *   Paragraph.getControlList()                    — 문단 내 컨트롤(표/도형/필드 등)
 *   DocInfo.*List()                               — face name / border / char shape / para shape / style / numbering / bullet
 */
@Service
public class HwpService {

    // ══════════════════════════════════════════════════════════════════════
    //  Parse HWP → JSON model (문자 서식 포함)
    // ══════════════════════════════════════════════════════════════════════

    public Map<String, Object> parseHwpFromBytes(byte[] bytes, String title) throws Exception {
        File temp = File.createTempFile("hc_hwp_r_", ".hwp");
        try {
            Files.write(temp.toPath(), bytes);
            HWPFile hwp = HWPReader.fromFile(temp.getAbsolutePath());
            return buildModel(hwp, title);
        } finally {
            temp.delete();
        }
    }

    private Map<String, Object> buildModel(HWPFile hwp, String title) {
        List<Map<String, Object>> sections = new ArrayList<>();
        List<Section> sectionList = hwp.getBodyText().getSectionList();
        DocInfo docInfo = hwp.getDocInfo();
        List<CharShape>  csLst = docInfo.getCharShapeList();
        List<ParaShape>  psLst = docInfo.getParaShapeList();

        for (Section section : sectionList) {
            List<Map<String, Object>> paragraphs = new ArrayList<>();
            PageDef foundPageDef = null;
            for (int pi = 0; pi < section.getParagraphCount(); pi++) {
                Paragraph para = section.getParagraph(pi);
                paragraphs.add(extractPara(hwp, para, csLst, psLst, sections.size(), pi));
                
                // Search for SectionDefine control (Page Setup)
                if (foundPageDef == null && para.getControlList() != null) {
                    for (Control ctrl : para.getControlList()) {
                        if (ctrl instanceof ControlSectionDefine csd) {
                            foundPageDef = csd.getPageDef();
                        }
                    }
                }
            }
            Map<String, Object> secMap = new java.util.LinkedHashMap<>();
            secMap.put("paragraphs", paragraphs);
            if (foundPageDef != null) {
                secMap.put("pageSetup", extractPageDef(foundPageDef));
            }
            sections.add(secMap);
        }

        Map<String, Object> model = new java.util.LinkedHashMap<>();
        model.put("title",        title);
        model.put("format",       "hwp");
        model.put("fileType",     "hwp");
        model.put("sectionCount", sections.size());
        model.put("sections",     sections);
        model.put("docInfo",      extractDocInfo(docInfo));
        return model;
    }

    private Map<String, Object> extractDocInfo(DocInfo docInfo) {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("hangulFaceNames", extractFaceNames(docInfo.getHangulFaceNameList()));
        info.put("englishFaceNames", extractFaceNames(docInfo.getEnglishFaceNameList()));
        info.put("hanjaFaceNames", extractFaceNames(docInfo.getHanjaFaceNameList()));
        info.put("japaneseFaceNames", extractFaceNames(docInfo.getJapaneseFaceNameList()));
        info.put("etcFaceNames", extractFaceNames(docInfo.getEtcFaceNameList()));
        info.put("symbolFaceNames", extractFaceNames(docInfo.getSymbolFaceNameList()));
        info.put("userFaceNames", extractFaceNames(docInfo.getUserFaceNameList()));
        info.put("charShapes", extractCharShapes(docInfo.getCharShapeList()));
        info.put("paraShapes", extractParaShapes(docInfo.getParaShapeList()));
        info.put("borderFills", extractBorderFills(docInfo.getBorderFillList()));
        info.put("styles", extractStyles(docInfo.getStyleList()));
        info.put("numberings", extractNumberings(docInfo.getNumberingList()));
        info.put("bullets", extractBullets(docInfo.getBulletList()));
        return info;
    }

    private List<Map<String, Object>> extractFaceNames(List<FaceName> list) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (FaceName faceName : list) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("name", faceName.getName());
            item.put("baseFontName", faceName.getBaseFontName());
            item.put("substituteFontName", faceName.getSubstituteFontName());
            item.put("substituteFontType", faceName.getSubstituteFontType() != null ? faceName.getSubstituteFontType().name() : null);
            out.add(item);
        }
        return out;
    }

    private List<Map<String, Object>> extractCharShapes(List<CharShape> list) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (CharShape cs : list) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("baseSize", cs.getBaseSize());
            item.put("bold", cs.getProperty().isBold());
            item.put("italic", cs.getProperty().isItalic());
            item.put("superScript", cs.getProperty().isSuperScript());
            item.put("subScript", cs.getProperty().isSubScript());
            item.put("strikeLine", cs.getProperty().isStrikeLine());
            item.put("underlineSort", cs.getProperty().getUnderLineSort() != null ? cs.getProperty().getUnderLineSort().name() : null);
            item.put("fontIds", cs.getFaceNameIds().getArray());
            item.put("charSpaces", cs.getCharSpaces().getArray());
            item.put("ratios", cs.getRatios().getArray());
            item.put("textColor", color4ToHex(cs.getCharColor()));
            item.put("underlineColor", color4ToHex(cs.getUnderLineColor()));
            item.put("shadeColor", color4ToHex(cs.getShadeColor()));
            out.add(item);
        }
        return out;
    }

    private List<Map<String, Object>> extractParaShapes(List<ParaShape> list) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (ParaShape ps : list) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("alignment", ps.getProperty1().getAlignment() != null ? ps.getProperty1().getAlignment().name() : null);
            item.put("leftMargin", ps.getLeftMargin());
            item.put("rightMargin", ps.getRightMargin());
            item.put("indent", ps.getIndent());
            item.put("topParaSpace", ps.getTopParaSpace());
            item.put("bottomParaSpace", ps.getBottomParaSpace());
            item.put("lineSpace", ps.getLineSpace());
            item.put("lineSpace2", ps.getLineSpace2());
            item.put("paraLevel", ps.getParaLevel());
            out.add(item);
        }
        return out;
    }

    private List<Map<String, Object>> extractBorderFills(List<BorderFill> list) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (BorderFill borderFill : list) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("property", borderFill.getProperty() != null ? borderFill.getProperty().getValue() : null);
            item.put("leftBorder", borderFill.getLeftBorder() != null ? borderFill.getLeftBorder().getType().name() : null);
            item.put("leftBorderThickness", borderFill.getLeftBorder() != null && borderFill.getLeftBorder().getThickness() != null ? borderFill.getLeftBorder().getThickness().name() : null);
            item.put("rightBorder", borderFill.getRightBorder() != null ? borderFill.getRightBorder().getType().name() : null);
            item.put("rightBorderThickness", borderFill.getRightBorder() != null && borderFill.getRightBorder().getThickness() != null ? borderFill.getRightBorder().getThickness().name() : null);
            item.put("topBorder", borderFill.getTopBorder() != null ? borderFill.getTopBorder().getType().name() : null);
            item.put("topBorderThickness", borderFill.getTopBorder() != null && borderFill.getTopBorder().getThickness() != null ? borderFill.getTopBorder().getThickness().name() : null);
            item.put("bottomBorder", borderFill.getBottomBorder() != null ? borderFill.getBottomBorder().getType().name() : null);
            item.put("bottomBorderThickness", borderFill.getBottomBorder() != null && borderFill.getBottomBorder().getThickness() != null ? borderFill.getBottomBorder().getThickness().name() : null);
            item.put("fillType", borderFill.getFillInfo() != null && borderFill.getFillInfo().getType() != null ? borderFill.getFillInfo().getType().getValue() : null);
            out.add(item);
        }
        return out;
    }

    private List<Map<String, Object>> extractStyles(List<Style> list) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Style style : list) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("hangulName", style.getHangulName());
            item.put("englishName", style.getEnglishName());
            item.put("nextStyleId", style.getNextStyleId());
            item.put("languageId", style.getLanguageId());
            item.put("paraShapeId", style.getParaShapeId());
            item.put("charShapeId", style.getCharShapeId());
            out.add(item);
        }
        return out;
    }

    private List<Map<String, Object>> extractNumberings(List<Numbering> list) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Numbering numbering : list) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("startNumber", numbering.getStartNumber());
            item.put("levels", numbering.getLevelNumberingList().size());
            out.add(item);
        }
        return out;
    }

    private List<Map<String, Object>> extractBullets(List<Bullet> list) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Bullet bullet : list) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("bulletChar", bullet.getBulletChar() != null ? bullet.getBulletChar().toString() : null);
            item.put("imageBullet", bullet.getImageBullet());
            item.put("checkBulletChar", bullet.getCheckBulletChar() != null ? bullet.getCheckBulletChar().toString() : null);
            out.add(item);
        }
        return out;
    }

    private String color4ToHex(kr.dogfoot.hwplib.object.etc.Color4Byte color) {
        if (color == null) return null;
        return String.format("#%02X%02X%02X", color.getR(), color.getG(), color.getB());
    }

    private Map<String, Object> extractPageDef(PageDef pageDef) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (pageDef == null) return m;
        m.put("paperWidth", pageDef.getPaperWidth());
        m.put("paperHeight", pageDef.getPaperHeight());
        m.put("leftMargin", pageDef.getLeftMargin());
        m.put("rightMargin", pageDef.getRightMargin());
        m.put("topMargin", pageDef.getTopMargin());
        m.put("bottomMargin", pageDef.getBottomMargin());
        m.put("headerMargin", pageDef.getHeaderMargin());
        m.put("footerMargin", pageDef.getFooterMargin());
        m.put("gutterMargin", pageDef.getGutterMargin());
        return m;
    }

    private Map<String, Object> extractPara(HWPFile hwp,
                                             Paragraph para,
                                             List<CharShape> csList,
                                             List<ParaShape> psList,
                                             int sectionIndex,
                                             int paragraphIndex) {
        // ── 텍스트 추출 ───────────────────────────────────────────────────
        StringBuilder sb = new StringBuilder();
        if (para.getText() != null) {
            for (HWPChar ch : para.getText().getCharList()) {
                if (ch instanceof HWPCharNormal) {
                    char c = (char) ((HWPCharNormal) ch).getCode();
                    if (c != '\r' && c != '\n' && c != 0) sb.append(c);
                }
            }
        }

        // ── 문자 서식 ─────────────────────────────────────────────────────
        String  fontName   = "NanumGothic";
        int     fontSize   = 10;
        boolean bold       = false, italic     = false;
        boolean underline  = false, strike     = false;
        boolean sup        = false, sub        = false;
        String  color      = "#000000";
        double  letterSpc  = 0.0;
        int     scaleX     = 100;

        try {
            ParaCharShape pcs = para.getCharShape();
            if (pcs != null && !pcs.getPositonShapeIdPairList().isEmpty()) {
                long csId = pcs.getPositonShapeIdPairList().get(0).getShapeId();
                if (csId >= 0 && csId < csList.size()) {
                    CharShape cs = csList.get((int) csId);
                    fontSize  = cs.getBaseSize() / 100;
                    bold      = cs.getProperty().isBold();
                    italic    = cs.getProperty().isItalic();
                    underline = cs.getProperty().getUnderLineSort() != UnderLineSort.None;
                    strike    = cs.getProperty().isStrikeLine();
                    sup       = cs.getProperty().isSuperScript();
                    sub       = cs.getProperty().isSubScript();
                    // 색상
                    int r = cs.getCharColor().getR();
                    int g = cs.getCharColor().getG();
                    int b = cs.getCharColor().getB();
                    color = String.format("#%02X%02X%02X", r, g, b);
                    // 자간/장평
                    letterSpc = cs.getCharSpaces().getHangul() / 100.0;
                    scaleX    = cs.getRatios().getHangul();
                }
            }
        } catch (Exception ignored) {}

        // ── 컨트롤 메타데이터 ───────────────────────────────────────────
        List<Map<String, Object>> controls = new ArrayList<>();
        try {
            if (para.getControlList() != null) {
                for (Control control : para.getControlList()) {
                    controls.add(extractControl(hwp, control, sectionIndex, paragraphIndex, sb.toString()));
                }
            }
        } catch (Exception ignored) {}

        // ── 문단 서식 ─────────────────────────────────────────────────────
        String align       = "left";
        double lineSpace   = 1.6;
        double spaceBefore = 0, spaceAfter = 0;

        try {
            long psIdx = para.getHeader().getParaShapeId();
            if (psIdx >= 0 && psIdx < psList.size()) {
                ParaShape ps = psList.get((int) psIdx);
                Alignment al = ps.getProperty1().getAlignment();
                align = switch (al) {
                    case Center    -> "center";
                    case Right     -> "right";
                    case Justify   -> "justify";
                    case Distribute, Divide -> "distribute";
                    default        -> "left";
                };
                lineSpace   = ps.getLineSpace() / 100.0;
                spaceBefore = ps.getTopParaSpace()    / 100.0;
                spaceAfter  = ps.getBottomParaSpace() / 100.0;
            }
        } catch (Exception ignored) {}

        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("text",                   sb.toString());
        m.put("fontName",               fontName);
        m.put("fontSize",               Math.max(fontSize, 1));
        m.put("bold",                   bold);
        m.put("italic",                 italic);
        m.put("underline",              underline);
        m.put("strikethrough",          strike);
        m.put("superscript",            sup);
        m.put("subscript",              sub);
        m.put("textColor",              color);
        m.put("letterSpacing",          letterSpc);
        m.put("textScaleX",             scaleX);
        m.put("align",                  align);
        m.put("lineSpacing",            lineSpace);
        m.put("paragraphSpacingBefore", spaceBefore);
        m.put("paragraphSpacingAfter",  spaceAfter);
        if (!controls.isEmpty()) {
            m.put("controls", controls);
        }
        return m;
    }

    private Map<String, Object> extractControl(HWPFile hwp, Control control, int sectionIndex, int paragraphIndex, String paragraphText) {
        Map<String, Object> item = new LinkedHashMap<>();
        ControlType type = control.getType();
        item.put("type", type != null ? type.name() : null);
        item.put("ctrlId", type != null ? type.getCtrlId() : null);
        item.put("isField", control.isField());
        item.put("sectionIndex", sectionIndex);
        item.put("paragraphIndex", paragraphIndex);
        item.put("paragraphText", paragraphText);

        if (control instanceof ControlTable table) {
            item.put("table", extractTable(hwp, table));
        } else if (control instanceof ControlPicture pic) {
            item.put("picture", extractPicture(hwp, pic));
        } else if (control instanceof GsoControl gso) {
            GsoControlType gsoType = gso.getGsoType();
            item.put("gsoType", gsoType != null ? gsoType.name() : null);
            item.put("gsoId", gso.getGsoId());
        }
        return item;
    }

    private Map<String, Object> extractTable(HWPFile hwp, ControlTable table) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("rowCount", table.getRowList().size());
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Row row : table.getRowList()) {
            Map<String, Object> rowMap = new LinkedHashMap<>();
            List<Map<String, Object>> cells = new ArrayList<>();
            for (Cell cell : row.getCellList()) {
                Map<String, Object> cellMap = new LinkedHashMap<>();
                cellMap.put("width", cell.getListHeader().getWidth());
                cellMap.put("height", cell.getListHeader().getHeight());
                cellMap.put("colSpan", cell.getListHeader().getColSpan());
                cellMap.put("rowSpan", cell.getListHeader().getRowSpan());
                // Cell paragraphs
                List<Map<String, Object>> cellParas = new ArrayList<>();
                for (Paragraph p : cell.getParagraphList()) {
                    cellParas.add(extractPara(hwp, p, hwp.getDocInfo().getCharShapeList(), hwp.getDocInfo().getParaShapeList(), -1, -1));
                }
                cellMap.put("paragraphs", cellParas);
                cells.add(cellMap);
            }
            rowMap.put("cells", cells);
            rows.add(rowMap);
        }
        m.put("rows", rows);
        return m;
    }

    private Map<String, Object> extractPicture(HWPFile hwp, ControlPicture pic) {
        Map<String, Object> m = new LinkedHashMap<>();
        try {
            m.put("binId", pic.getShapeComponentPicture().getPictureInfo().getBinItemID());
            m.put("width", pic.getHeader().getWidth());
            m.put("height", pic.getHeader().getHeight());
        } catch (Exception ignored) {}
        return m;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Save HWP — 원본 구조 유지, 텍스트+서식 업데이트
    // ══════════════════════════════════════════════════════════════════════

    @SuppressWarnings("unchecked")
    public byte[] saveHwp(byte[] originalBytes, Map<String, Object> docModel) throws Exception {
        File temp = File.createTempFile("hc_hwp_w_", ".hwp");
        try {
            Files.write(temp.toPath(), originalBytes);
            HWPFile hwp = HWPReader.fromFile(temp.getAbsolutePath());
            List<Map<String, Object>> sections =
                (List<Map<String, Object>>) docModel.get("sections");
            if (sections == null) return toBytes(hwp);

            List<Section> secList = hwp.getBodyText().getSectionList();
            for (int si = 0; si < secList.size() && si < sections.size(); si++) {
                Section sec = secList.get(si);
                List<Map<String, Object>> parasData =
                    (List<Map<String, Object>>) sections.get(si).get("paragraphs");
                if (parasData == null) continue;

                for (int pi = 0; pi < sec.getParagraphCount() && pi < parasData.size(); pi++) {
                    Paragraph para   = sec.getParagraph(pi);
                    Map<String, Object> pData = parasData.get(pi);
                    applyParaText(hwp, para, pData);
                    applyParaFormatting(hwp, para, pData, si, pi);
                    applyParaControls(hwp, para, pData, si, pi);
                }
                // Apply PageSetup
                Map<String, Object> psData = (Map<String, Object>) sections.get(si).get("pageSetup");
                if (psData != null) {
                    for (int pi = 0; pi < sec.getParagraphCount(); pi++) {
                        Paragraph p = sec.getParagraph(pi);
                        if (p.getControlList() != null) {
                            for (Control ctrl : p.getControlList()) {
                                if (ctrl instanceof ControlSectionDefine csd) {
                                    applyPageDef(csd.getPageDef(), psData);
                                }
                            }
                        }
                    }
                }
            }
            return toBytes(hwp);
        } finally {
            temp.delete();
        }
    }

    /** 문단 텍스트 교체 */
    private void applyParaText(HWPFile hwp, Paragraph para, Map<String, Object> d)
            throws Exception {
        String newText = d.get("text") instanceof String s ? s : "";
        if (para.getText() == null) para.createText();

        // Lossless: if the paragraph contains control chars (pictures/fields/etc),
        // do not wipe them by clearing the entire char list.
        boolean hasNonNormal = false;
        for (HWPChar ch : para.getText().getCharList()) {
            if (!(ch instanceof HWPCharNormal)) {
                hasNonNormal = true;
                break;
            }
        }

        if (hasNonNormal) {
            // Preserve complex paragraph structure by only replacing normal chars in place.
            replaceNormalCharsPreservingControls(para.getText(), newText);
            return;
        }

        para.getText().getCharList().clear();
        if (!newText.isEmpty()) para.getText().addString(newText);
    }

    private void replaceNormalCharsPreservingControls(ParaText text, String newText) {
        List<HWPChar> original = new ArrayList<>(text.getCharList());
        List<HWPChar> rebuilt = new ArrayList<>(original.size() + Math.max(0, newText.length() - original.size()));

        int textIndex = 0;
        for (HWPChar ch : original) {
            if (ch instanceof HWPCharNormal) {
                if (textIndex < newText.length()) {
                    rebuilt.add(new HWPCharNormal(newText.charAt(textIndex++)));
                }
                // Drop trailing normal characters when the replacement text is shorter.
            } else {
                try {
                    rebuilt.add(ch.clone());
                } catch (Exception ignored) {
                    rebuilt.add(ch);
                }
            }
        }

        while (textIndex < newText.length()) {
            rebuilt.add(new HWPCharNormal(newText.charAt(textIndex++)));
        }

        text.getCharList().clear();
        text.getCharList().addAll(rebuilt);
    }

    /** 문단 서식 적용 (CharShape + ParaShape 업데이트) */
    private void applyParaFormatting(HWPFile hwp, Paragraph para,
                                     Map<String, Object> d, int si, int pi) {
        // ── CharShape ────────────────────────────────────────────────────
        CharShape cs = ensureCharShape(hwp, para, si, pi);

        int fontSize = d.get("fontSize") instanceof Number n ? n.intValue() : 10;
        cs.setBaseSize(fontSize * 100);

        cs.getProperty().setBold(Boolean.TRUE.equals(d.get("bold")));
        cs.getProperty().setItalic(Boolean.TRUE.equals(d.get("italic")));
        cs.getProperty().setSuperScript(Boolean.TRUE.equals(d.get("superscript")));
        cs.getProperty().setSubScript(Boolean.TRUE.equals(d.get("subscript")));
        cs.getProperty().setStrikeLine(Boolean.TRUE.equals(d.get("strikethrough")));
        cs.getProperty().setUnderLineSort(
            Boolean.TRUE.equals(d.get("underline")) ? UnderLineSort.Bottom : UnderLineSort.None);

        // 색상
        if (d.get("textColor") instanceof String tc && tc.startsWith("#") && tc.length() == 7) {
            try {
                int r = Integer.parseInt(tc.substring(1, 3), 16);
                int g = Integer.parseInt(tc.substring(3, 5), 16);
                int b = Integer.parseInt(tc.substring(5, 7), 16);
                cs.getCharColor().setR((short) r);
                cs.getCharColor().setG((short) g);
                cs.getCharColor().setB((short) b);
            } catch (Exception ignored) {}
        }

        // 폰트 (한글 폰트 목록에서 ID 찾거나 새로 추가)
        if (d.get("fontName") instanceof String fn && !fn.isBlank()) {
            int fontId = ensureFontId(hwp, fn);
            cs.getFaceNameIds().setForAll(fontId);
        }

        // 자간 (CharSpaces: byte, -50~50%)
        if (d.get("letterSpacing") instanceof Number ls) {
            byte spc = (byte) Math.max(-50, Math.min(50, (int)(ls.doubleValue() * 100)));
            cs.getCharSpaces().setForAll(spc);
        }

        // 장평 (Ratios: byte, 50~200%)
        if (d.get("textScaleX") instanceof Number sx) {
            byte r = (byte) Math.max(50, Math.min(200, sx.intValue()));
            cs.getRatios().setForAll(r);
        }

        // ── ParaShape ────────────────────────────────────────────────────
        ParaShape ps = ensureParaShape(hwp, para, si, pi);

        if (d.get("align") instanceof String align) {
            Alignment a = switch (align) {
                case "center"     -> Alignment.Center;
                case "right"      -> Alignment.Right;
                case "justify"    -> Alignment.Justify;
                case "distribute" -> Alignment.Distribute;
                default           -> Alignment.Left;
            };
            ps.getProperty1().setAlignment(a);
        }
        if (d.get("lineSpacing") instanceof Number ls)
            ps.setLineSpace((int)(ls.doubleValue() * 100));
        if (d.get("paragraphSpacingBefore") instanceof Number sb)
            ps.setTopParaSpace((int)(sb.doubleValue() * 100));
        if (d.get("paragraphSpacingAfter") instanceof Number sa)
            ps.setBottomParaSpace((int)(sa.doubleValue() * 100));
    }

    // ── Helper: CharShape 확보 ────────────────────────────────────────────

    private CharShape ensureCharShape(HWPFile hwp, Paragraph para, int si, int pi) {
        // 기존 CharShape ID를 참조하거나 새로 추가
        List<CharShape> csList = hwp.getDocInfo().getCharShapeList();
        if (para.getCharShape() != null
                && !para.getCharShape().getPositonShapeIdPairList().isEmpty()) {
            long csId = para.getCharShape().getPositonShapeIdPairList().get(0).getShapeId();
            if (csId >= 0 && csId < csList.size()) {
                return csList.get((int) csId);
            }
        }
        // 새 CharShape 추가
        CharShape cs = hwp.getDocInfo().addNewCharShape();
        int newId = csList.size() - 1;
        if (para.getCharShape() == null) para.createCharShape();
        para.getCharShape().getPositonShapeIdPairList().clear();
        para.getCharShape().addParaCharShape(0, newId);
        return cs;
    }

    // ── Helper: ParaShape 확보 ───────────────────────────────────────────

    private ParaShape ensureParaShape(HWPFile hwp, Paragraph para, int si, int pi) {
        List<ParaShape> psList = hwp.getDocInfo().getParaShapeList();
        long psId = para.getHeader().getParaShapeId();
        if (psId >= 0 && psId < psList.size()) {
            return psList.get((int) psId);
        }
        ParaShape ps = hwp.getDocInfo().addNewParaShape();
        int newId = psList.size() - 1;
        para.getHeader().setParaShapeId(newId);
        return ps;
    }

    // ── Helper: 폰트 ID 확보 ─────────────────────────────────────────────

    private int ensureFontId(HWPFile hwp, String fontName) {
        List<FaceName> list = hwp.getDocInfo().getHangulFaceNameList();
        for (int i = 0; i < list.size(); i++) {
            if (fontName.equals(list.get(i).getName())) return i;
        }
        FaceName fn = hwp.getDocInfo().addNewHangulFaceName();
        fn.setName(fontName);
        return list.size() - 1;
    }

    // ── HWPFile → byte[] ──────────────────────────────────────────────────

    private void applyPageDef(PageDef pageDef, Map<String, Object> d) {
        if (pageDef == null) return;
        if (d.get("paperWidth") instanceof Number n) pageDef.setPaperWidth(n.longValue());
        if (d.get("paperHeight") instanceof Number n) pageDef.setPaperHeight(n.longValue());
        if (d.get("leftMargin") instanceof Number n) pageDef.setLeftMargin(n.longValue());
        if (d.get("rightMargin") instanceof Number n) pageDef.setRightMargin(n.longValue());
        if (d.get("topMargin") instanceof Number n) pageDef.setTopMargin(n.longValue());
        if (d.get("bottomMargin") instanceof Number n) pageDef.setBottomMargin(n.longValue());
        if (d.get("headerMargin") instanceof Number n) pageDef.setHeaderMargin(n.longValue());
        if (d.get("footerMargin") instanceof Number n) pageDef.setFooterMargin(n.longValue());
        // if (d.get("gutterMargin") instanceof Number n) pageDef.setGutterMargin(n.longValue());
    }


    @SuppressWarnings("unchecked")
    private void applyParaControls(HWPFile hwp, Paragraph para, Map<String, Object> d, int si, int pi) {
        if (para.getControlList() == null) return;
        List<Map<String, Object>> controlsData = (List<Map<String, Object>>) d.get("controls");
        if (controlsData == null) return;

        for (int i = 0; i < para.getControlList().size() && i < controlsData.size(); i++) {
            kr.dogfoot.hwplib.object.bodytext.control.Control ctrl = para.getControlList().get(i);
            Map<String, Object> cData = controlsData.get(i);
            if (ctrl instanceof ControlTable table && cData.get("table") instanceof Map tableData) {
                applyTableUpdate(hwp, table, (Map<String, Object>) tableData);
            }
        }
    }

    @SuppressWarnings("unchecked")
    private void applyTableUpdate(HWPFile hwp, ControlTable table, Map<String, Object> d) {
        List<Map<String, Object>> rowsData = (List<Map<String, Object>>) d.get("rows");
        if (rowsData == null) return;
        for (int ri = 0; ri < table.getRowList().size() && ri < rowsData.size(); ri++) {
            Row row = table.getRowList().get(ri);
            Map<String, Object> rData = rowsData.get(ri);
            List<Map<String, Object>> cellsData = (List<Map<String, Object>>) rData.get("cells");
            if (cellsData == null) continue;
            for (int ci = 0; ci < row.getCellList().size() && ci < cellsData.size(); ci++) {
                Cell cell = row.getCellList().get(ci);
                Map<String, Object> cData = cellsData.get(ci);
                List<Map<String, Object>> parasData = (List<Map<String, Object>>) cData.get("paragraphs");
                if (parasData == null) continue;
                for (int pi = 0; pi < cell.getParagraphList().getParagraphCount() && pi < parasData.size(); pi++) {
                    Paragraph cp = cell.getParagraphList().getParagraph(pi);
                    Map<String, Object> cpData = parasData.get(pi);
                    try {
                        applyParaText(hwp, cp, cpData);
                        applyParaFormatting(hwp, cp, cpData, -1, -1);
                    } catch (Exception ignored) {}
                }
            }
        }
    }

    private byte[] toBytes(HWPFile hwp) throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        HWPWriter.toStream(hwp, baos);
        return baos.toByteArray();
    }
}
