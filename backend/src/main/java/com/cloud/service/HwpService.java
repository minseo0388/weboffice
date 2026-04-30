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
import kr.dogfoot.hwplib.object.bodytext.control.gso.ControlLine;
import kr.dogfoot.hwplib.object.bodytext.control.gso.ControlRectangle;
import kr.dogfoot.hwplib.object.bodytext.control.gso.ControlEllipse;
import kr.dogfoot.hwplib.object.bodytext.control.gso.ControlArc;
import kr.dogfoot.hwplib.object.bodytext.control.gso.ControlPolygon;
import kr.dogfoot.hwplib.object.bodytext.control.gso.ControlCurve;
import kr.dogfoot.hwplib.object.bodytext.control.gso.ControlOLE;
import kr.dogfoot.hwplib.object.bodytext.control.gso.ControlContainer;
import kr.dogfoot.hwplib.object.bodytext.control.ControlHeader;
import kr.dogfoot.hwplib.object.bodytext.control.ControlFooter;
import kr.dogfoot.hwplib.object.bodytext.control.ControlFootnote;
import kr.dogfoot.hwplib.object.bodytext.control.ControlEndnote;
import kr.dogfoot.hwplib.object.bodytext.control.ControlPageNumberPosition;
import kr.dogfoot.hwplib.object.bodytext.control.ControlEquation;
import kr.dogfoot.hwplib.object.bodytext.control.ControlField;
import kr.dogfoot.hwplib.object.bodytext.control.ControlBookmark;
import kr.dogfoot.hwplib.object.bodytext.control.ControlColumnDefine;
import kr.dogfoot.hwplib.object.bodytext.control.ControlHiddenComment;
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
import kr.dogfoot.hwplib.object.docinfo.borderfill.BorderFillProperty;
import kr.dogfoot.hwplib.object.docinfo.borderfill.BorderThickness;
import kr.dogfoot.hwplib.object.docinfo.borderfill.BorderType;
import kr.dogfoot.hwplib.object.docinfo.borderfill.fillinfo.FillType;
import kr.dogfoot.hwplib.object.docinfo.facename.FontType;
import kr.dogfoot.hwplib.object.docinfo.numbering.LevelNumbering;
import kr.dogfoot.hwplib.object.docinfo.numbering.ParagraphAlignment;
import kr.dogfoot.hwplib.object.docinfo.numbering.ParagraphHeadInfo;
import kr.dogfoot.hwplib.object.docinfo.numbering.ParagraphHeadInfoProperty;
import kr.dogfoot.hwplib.object.docinfo.numbering.ParagraphNumberFormat;
import kr.dogfoot.hwplib.object.docinfo.numbering.ValueType;
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
        } else if (control instanceof ControlHeader header) {
            item.put("paragraphs", extractParagraphList(hwp, header.getParagraphList()));
        } else if (control instanceof ControlFooter footer) {
            item.put("paragraphs", extractParagraphList(hwp, footer.getParagraphList()));
        } else if (control instanceof ControlFootnote footnote) {
            item.put("paragraphs", extractParagraphList(hwp, footnote.getParagraphList()));
        } else if (control instanceof ControlEndnote endnote) {
            item.put("paragraphs", extractParagraphList(hwp, endnote.getParagraphList()));
        } else if (control instanceof ControlHiddenComment hidden) {
            item.put("paragraphs", extractParagraphList(hwp, hidden.getParagraphList()));
        } else if (control instanceof GsoControl gso) {
            GsoControlType gsoType = gso.getGsoType();
            item.put("gsoType", gsoType != null ? gsoType.name() : null);
            item.put("gsoId", gso.getGsoId());
            
            kr.dogfoot.hwplib.object.bodytext.paragraph.ParagraphList pList = null;
            if (gso instanceof ControlRectangle rect && rect.getTextBox() != null) pList = rect.getTextBox().getParagraphList();
            else if (gso instanceof ControlEllipse ellipse && ellipse.getTextBox() != null) pList = ellipse.getTextBox().getParagraphList();
            else if (gso instanceof ControlArc arc && arc.getTextBox() != null) pList = arc.getTextBox().getParagraphList();
            else if (gso instanceof ControlPolygon poly && poly.getTextBox() != null) pList = poly.getTextBox().getParagraphList();
            else if (gso instanceof ControlCurve curve && curve.getTextBox() != null) pList = curve.getTextBox().getParagraphList();
            
            if (pList != null) {
                item.put("paragraphs", extractParagraphList(hwp, pList));
            }
        }
        return item;
    }

    private List<Map<String, Object>> extractParagraphList(HWPFile hwp, kr.dogfoot.hwplib.object.bodytext.paragraph.ParagraphList pList) {
        List<Map<String, Object>> list = new ArrayList<>();
        if (pList == null) return list;
        for (int i=0; i<pList.getParagraphCount(); i++) {
            list.add(extractPara(hwp, pList.getParagraph(i), hwp.getDocInfo().getCharShapeList(), hwp.getDocInfo().getParaShapeList(), -1, -1));
        }
        return list;
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
            applyDocInfoUpdates(hwp, docModel);
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

    @SuppressWarnings("unchecked")
    private void applyDocInfoUpdates(HWPFile hwp, Map<String, Object> docModel) {
        if (docModel == null) return;
        Object docInfoObj = docModel.get("docInfo");
        if (!(docInfoObj instanceof Map<?, ?> docInfoMap)) return;

        DocInfo docInfo = hwp.getDocInfo();
        applyFaceNameList(docInfo.getHangulFaceNameList(), (List<Map<String, Object>>) docInfoMap.get("hangulFaceNames"), docInfo::addNewHangulFaceName);
        applyFaceNameList(docInfo.getEnglishFaceNameList(), (List<Map<String, Object>>) docInfoMap.get("englishFaceNames"), docInfo::addNewEnglishFaceName);
        applyFaceNameList(docInfo.getHanjaFaceNameList(), (List<Map<String, Object>>) docInfoMap.get("hanjaFaceNames"), docInfo::addNewHanjaFaceName);
        applyFaceNameList(docInfo.getJapaneseFaceNameList(), (List<Map<String, Object>>) docInfoMap.get("japaneseFaceNames"), docInfo::addNewJapaneseFaceName);
        applyFaceNameList(docInfo.getEtcFaceNameList(), (List<Map<String, Object>>) docInfoMap.get("etcFaceNames"), docInfo::addNewEtcFaceName);
        applyFaceNameList(docInfo.getSymbolFaceNameList(), (List<Map<String, Object>>) docInfoMap.get("symbolFaceNames"), docInfo::addNewSymbolFaceName);
        applyFaceNameList(docInfo.getUserFaceNameList(), (List<Map<String, Object>>) docInfoMap.get("userFaceNames"), docInfo::addNewUserFaceName);

        applyBorderFillList(docInfo.getBorderFillList(), (List<Map<String, Object>>) docInfoMap.get("borderFills"), docInfo::addNewBorderFill);
        applyCharShapeList(docInfo, (List<Map<String, Object>>) docInfoMap.get("charShapes"));
        applyParaShapeList(docInfo, (List<Map<String, Object>>) docInfoMap.get("paraShapes"));
        applyStyleList(docInfo, (List<Map<String, Object>>) docInfoMap.get("styles"));
        applyNumberingList(docInfo, (List<Map<String, Object>>) docInfoMap.get("numberings"));
        applyBulletList(docInfo, (List<Map<String, Object>>) docInfoMap.get("bullets"));
    }

    private void applyFaceNameList(List<FaceName> target,
                                   List<Map<String, Object>> source,
                                   java.util.function.Supplier<FaceName> creator) {
        if (source == null) return;
        for (int i = 0; i < source.size(); i++) {
            FaceName faceName = i < target.size() ? target.get(i) : creator.get();
            Map<String, Object> item = source.get(i);
            if (item.get("name") instanceof String name) faceName.setName(name);
            if (item.get("baseFontName") instanceof String baseFontName) faceName.setBaseFontName(baseFontName);
            if (item.get("substituteFontName") instanceof String substituteFontName) faceName.setSubstituteFontName(substituteFontName);
            if (item.get("substituteFontType") instanceof String substituteFontType) {
                try {
                    faceName.setSubstituteFontType(FontType.valueOf(substituteFontType));
                } catch (Exception ignored) {}
            }
        }
    }

    private void applyBorderFillList(List<BorderFill> target,
                                     List<Map<String, Object>> source,
                                     java.util.function.Supplier<BorderFill> creator) {
        if (source == null) return;
        for (int i = 0; i < source.size(); i++) {
            BorderFill borderFill = i < target.size() ? target.get(i) : creator.get();
            Map<String, Object> item = source.get(i);
            if (item.get("property") instanceof Number property) {
                borderFill.getProperty().setValue(property.intValue());
            }
            applyEachBorder(borderFill.getLeftBorder(), item, "leftBorder", "leftBorderThickness");
            applyEachBorder(borderFill.getRightBorder(), item, "rightBorder", "rightBorderThickness");
            applyEachBorder(borderFill.getTopBorder(), item, "topBorder", "topBorderThickness");
            applyEachBorder(borderFill.getBottomBorder(), item, "bottomBorder", "bottomBorderThickness");
            if (item.get("fillType") instanceof Number fillType) {
                borderFill.getFillInfo().getType().setValue(fillType.longValue());
            }
        }
    }

    private void applyEachBorder(kr.dogfoot.hwplib.object.docinfo.borderfill.EachBorder border,
                                 Map<String, Object> item,
                                 String typeKey,
                                 String thicknessKey) {
        if (item.get(typeKey) instanceof String type) {
            try {
                border.setType(BorderType.valueOf(type));
            } catch (Exception ignored) {}
        }
        if (item.get(thicknessKey) instanceof String thickness) {
            try {
                border.setThickness(BorderThickness.valueOf(thickness));
            } catch (Exception ignored) {}
        }
    }

    private void applyCharShapeList(DocInfo docInfo, List<Map<String, Object>> source) {
        if (source == null) return;
        List<CharShape> target = docInfo.getCharShapeList();
        for (int i = 0; i < source.size(); i++) {
            CharShape charShape = i < target.size() ? target.get(i) : docInfo.addNewCharShape();
            Map<String, Object> item = source.get(i);
            if (item.get("baseSize") instanceof Number baseSize) charShape.setBaseSize(baseSize.intValue());
            if (item.get("bold") instanceof Boolean bold) charShape.getProperty().setBold(bold);
            if (item.get("italic") instanceof Boolean italic) charShape.getProperty().setItalic(italic);
            if (item.get("superScript") instanceof Boolean superScript) charShape.getProperty().setSuperScript(superScript);
            if (item.get("subScript") instanceof Boolean subScript) charShape.getProperty().setSubScript(subScript);
            if (item.get("strikeLine") instanceof Boolean strikeLine) charShape.getProperty().setStrikeLine(strikeLine);
            if (item.get("underlineSort") instanceof String underlineSort) {
                try {
                    charShape.getProperty().setUnderLineSort(UnderLineSort.valueOf(underlineSort));
                } catch (Exception ignored) {}
            }
            if (item.get("fontIds") instanceof List<?> fontIds && !fontIds.isEmpty()) {
                int[] ids = toIntArray(fontIds);
                try {
                    charShape.getFaceNameIds().setArray(ids);
                } catch (Exception ignored) {
                    charShape.getFaceNameIds().setForAll(ids[0]);
                }
            }
            if (item.get("charSpaces") instanceof List<?> charSpaces && !charSpaces.isEmpty()) {
                byte[] values = toByteArray(charSpaces);
                try {
                    charShape.getCharSpaces().setArray(values);
                } catch (Exception ignored) {
                    charShape.getCharSpaces().setForAll(values[0]);
                }
            }
            if (item.get("ratios") instanceof List<?> ratios && !ratios.isEmpty()) {
                short[] values = toShortArray(ratios);
                try {
                    charShape.getRatios().setArray(values);
                } catch (Exception ignored) {
                    charShape.getRatios().setForAll(values[0]);
                }
            }
            if (item.get("textColor") instanceof String textColor) applyColor(charShape.getCharColor(), textColor);
            if (item.get("underlineColor") instanceof String underlineColor) applyColor(charShape.getUnderLineColor(), underlineColor);
            if (item.get("shadeColor") instanceof String shadeColor) applyColor(charShape.getShadeColor(), shadeColor);
        }
    }

    private void applyParaShapeList(DocInfo docInfo, List<Map<String, Object>> source) {
        if (source == null) return;
        List<ParaShape> target = docInfo.getParaShapeList();
        for (int i = 0; i < source.size(); i++) {
            ParaShape paraShape = i < target.size() ? target.get(i) : docInfo.addNewParaShape();
            Map<String, Object> item = source.get(i);
            if (item.get("alignment") instanceof String alignment) {
                try {
                    paraShape.getProperty1().setAlignment(Alignment.valueOf(alignment));
                } catch (Exception ignored) {}
            }
            if (item.get("leftMargin") instanceof Number leftMargin) paraShape.setLeftMargin(leftMargin.intValue());
            if (item.get("rightMargin") instanceof Number rightMargin) paraShape.setRightMargin(rightMargin.intValue());
            if (item.get("indent") instanceof Number indent) paraShape.setIndent(indent.intValue());
            if (item.get("topParaSpace") instanceof Number topParaSpace) paraShape.setTopParaSpace(topParaSpace.intValue());
            if (item.get("bottomParaSpace") instanceof Number bottomParaSpace) paraShape.setBottomParaSpace(bottomParaSpace.intValue());
            if (item.get("lineSpace") instanceof Number lineSpace) paraShape.setLineSpace(lineSpace.intValue());
            if (item.get("lineSpace2") instanceof Number lineSpace2) paraShape.setLineSpace2(lineSpace2.intValue());
            if (item.get("paraLevel") instanceof Number paraLevel) paraShape.setParaLevel(paraLevel.intValue());
        }
    }

    private void applyStyleList(DocInfo docInfo, List<Map<String, Object>> source) {
        if (source == null) return;
        List<Style> target = docInfo.getStyleList();
        for (int i = 0; i < source.size(); i++) {
            Style style = i < target.size() ? target.get(i) : docInfo.addNewStyle();
            Map<String, Object> item = source.get(i);
            if (item.get("hangulName") instanceof String hangulName) style.setHangulName(hangulName);
            if (item.get("englishName") instanceof String englishName) style.setEnglishName(englishName);
            if (item.get("nextStyleId") instanceof Number nextStyleId) style.setNextStyleId(nextStyleId.shortValue());
            if (item.get("languageId") instanceof Number languageId) style.setLanguageId(languageId.shortValue());
            if (item.get("paraShapeId") instanceof Number paraShapeId) style.setParaShapeId(paraShapeId.intValue());
            if (item.get("charShapeId") instanceof Number charShapeId) style.setCharShapeId(charShapeId.intValue());
        }
    }

    private void applyNumberingList(DocInfo docInfo, List<Map<String, Object>> source) {
        if (source == null) return;
        List<Numbering> target = docInfo.getNumberingList();
        for (int i = 0; i < source.size(); i++) {
            Numbering numbering = i < target.size() ? target.get(i) : docInfo.addNewNumbering();
            Map<String, Object> item = source.get(i);
            if (item.get("startNumber") instanceof Number startNumber) numbering.setStartNumber(startNumber.intValue());
            if (item.get("levels") instanceof Number levels) {
                ensureLevelNumberingCount(numbering, levels.intValue());
            }
            if (item.get("levelStartNumbers") instanceof List<?> levelStartNumbers) {
                ensureLevelNumberingCount(numbering, levelStartNumbers.size());
                for (int levelIndex = 0; levelIndex < levelStartNumbers.size() && levelIndex < numbering.getLevelNumberingList().size(); levelIndex++) {
                    Object value = levelStartNumbers.get(levelIndex);
                    if (value instanceof Number start) {
                        numbering.getLevelNumberingList().get(levelIndex).setStartNumber(start.longValue());
                    }
                }
            }
        }
    }

    private void ensureLevelNumberingCount(Numbering numbering, int count) {
        while (numbering.getLevelNumberingList().size() < count) {
            numbering.getLevelNumberingList().add(new LevelNumbering());
        }
    }

    private void applyBulletList(DocInfo docInfo, List<Map<String, Object>> source) {
        if (source == null) return;
        List<Bullet> target = docInfo.getBulletList();
        for (int i = 0; i < source.size(); i++) {
            Bullet bullet = i < target.size() ? target.get(i) : docInfo.addNewBullet();
            Map<String, Object> item = source.get(i);
            if (item.get("imageBullet") instanceof Boolean imageBullet) bullet.setImageBullet(imageBullet);
            if (item.get("bulletChar") instanceof String bulletChar && bullet.getBulletChar() != null) {
                bullet.getBulletChar().fromUTF16LEString(bulletChar);
            }
            if (item.get("checkBulletChar") instanceof String checkBulletChar && bullet.getCheckBulletChar() != null) {
                bullet.getCheckBulletChar().fromUTF16LEString(checkBulletChar);
            }
            if (item.get("paragraphHeadInfo") instanceof Map<?, ?> paragraphHeadInfoMap) {
                applyParagraphHeadInfo(bullet.getParagraphHeadInfo(), paragraphHeadInfoMap);
            }
        }
    }

    private void applyParagraphHeadInfo(ParagraphHeadInfo paragraphHeadInfo, Map<?, ?> item) {
        if (paragraphHeadInfo == null || item == null) return;
        ParagraphHeadInfoProperty property = paragraphHeadInfo.getProperty();
        if (item.get("value") instanceof Number value) property.setValue(value.longValue());
        if (item.get("paragraphAlignment") instanceof String paragraphAlignment) {
            try {
                property.setParagraphAlignment(ParagraphAlignment.valueOf(paragraphAlignment));
            } catch (Exception ignored) {}
        }
        if (item.get("followStringWidth") instanceof Boolean followStringWidth) property.setFollowStringWidth(followStringWidth);
        if (item.get("autoIndent") instanceof Boolean autoIndent) property.setAutoIndent(autoIndent);
        if (item.get("valueTypeForDistanceFromBody") instanceof String valueTypeForDistanceFromBody) {
            try {
                property.setValueTypeForDistanceFromBody(ValueType.valueOf(valueTypeForDistanceFromBody));
            } catch (Exception ignored) {}
        }
        if (item.get("paragraphNumberFormat") instanceof String paragraphNumberFormat) {
            try {
                property.setParagraphNumberFormat(ParagraphNumberFormat.valueOf(paragraphNumberFormat));
            } catch (Exception ignored) {}
        }
        if (item.get("correctionValueForWidth") instanceof Number correctionValueForWidth) {
            paragraphHeadInfo.setCorrectionValueForWidth(correctionValueForWidth.intValue());
        }
        if (item.get("distanceFromBody") instanceof Number distanceFromBody) {
            paragraphHeadInfo.setDistanceFromBody(distanceFromBody.intValue());
        }
        if (item.get("charShapeID") instanceof Number charShapeID) {
            paragraphHeadInfo.setCharShapeID(charShapeID.longValue());
        }
    }

    private void applyColor(kr.dogfoot.hwplib.object.etc.Color4Byte color, String hex) {
        if (color == null || hex == null || !hex.startsWith("#") || hex.length() != 7) return;
        try {
            color.setR((short) Integer.parseInt(hex.substring(1, 3), 16));
            color.setG((short) Integer.parseInt(hex.substring(3, 5), 16));
            color.setB((short) Integer.parseInt(hex.substring(5, 7), 16));
        } catch (Exception ignored) {}
    }

    private int[] toIntArray(List<?> values) {
        int[] array = new int[values.size()];
        for (int i = 0; i < values.size(); i++) {
            Object value = values.get(i);
            array[i] = value instanceof Number number ? number.intValue() : 0;
        }
        return array;
    }

    private byte[] toByteArray(List<?> values) {
        byte[] array = new byte[values.size()];
        for (int i = 0; i < values.size(); i++) {
            Object value = values.get(i);
            array[i] = value instanceof Number number ? number.byteValue() : 0;
        }
        return array;
    }

    private short[] toShortArray(List<?> values) {
        short[] array = new short[values.size()];
        for (int i = 0; i < values.size(); i++) {
            Object value = values.get(i);
            array[i] = value instanceof Number number ? number.shortValue() : 0;
        }
        return array;
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

        int ci = 0;
        for (kr.dogfoot.hwplib.object.bodytext.control.Control ctrl : para.getControlList()) {
            if (ci >= controlsData.size()) break;
            Map<String, Object> cData = controlsData.get(ci);
            
            if (ctrl instanceof ControlTable table && cData.get("table") instanceof Map tableData) {
                applyTableUpdate(hwp, table, (Map<String, Object>) tableData);
            } else if (ctrl instanceof ControlHeader header) {
                applyParagraphListUpdate(hwp, header.getParagraphList(), cData);
            } else if (ctrl instanceof ControlFooter footer) {
                applyParagraphListUpdate(hwp, footer.getParagraphList(), cData);
            } else if (ctrl instanceof ControlFootnote footnote) {
                applyParagraphListUpdate(hwp, footnote.getParagraphList(), cData);
            } else if (ctrl instanceof ControlEndnote endnote) {
                applyParagraphListUpdate(hwp, endnote.getParagraphList(), cData);
            } else if (ctrl instanceof ControlHiddenComment hidden) {
                applyParagraphListUpdate(hwp, hidden.getParagraphList(), cData);
            } else if (ctrl instanceof kr.dogfoot.hwplib.object.bodytext.control.gso.GsoControl gso) {
                kr.dogfoot.hwplib.object.bodytext.paragraph.ParagraphList pList = null;
                if (gso instanceof ControlRectangle rect && rect.getTextBox() != null) pList = rect.getTextBox().getParagraphList();
                else if (gso instanceof ControlEllipse ellipse && ellipse.getTextBox() != null) pList = ellipse.getTextBox().getParagraphList();
                else if (gso instanceof ControlArc arc && arc.getTextBox() != null) pList = arc.getTextBox().getParagraphList();
                else if (gso instanceof ControlPolygon poly && poly.getTextBox() != null) pList = poly.getTextBox().getParagraphList();
                else if (gso instanceof ControlCurve curve && curve.getTextBox() != null) pList = curve.getTextBox().getParagraphList();
                
                if (pList != null) {
                    applyParagraphListUpdate(hwp, pList, cData);
                }
            }
            ci++;
        }
    }

    @SuppressWarnings("unchecked")
    private void applyParagraphListUpdate(HWPFile hwp, kr.dogfoot.hwplib.object.bodytext.paragraph.ParagraphList pList, Map<String, Object> cData) {
        if (pList == null) return;
        List<Map<String, Object>> parasData = (List<Map<String, Object>>) cData.get("paragraphs");
        if (parasData == null) return;
        for (int i = 0; i < pList.getParagraphCount() && i < parasData.size(); i++) {
            Paragraph cp = pList.getParagraph(i);
            Map<String, Object> cpData = parasData.get(i);
            try {
                applyParaText(hwp, cp, cpData);
                applyParaFormatting(hwp, cp, cpData, -1, -1);
            } catch (Exception ignored) {}
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
