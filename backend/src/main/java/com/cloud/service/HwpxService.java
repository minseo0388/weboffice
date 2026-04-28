package com.cloud.service;

import kr.dogfoot.hwpxlib.object.HWPXFile;
import kr.dogfoot.hwpxlib.object.common.ObjectList;
import kr.dogfoot.hwpxlib.object.content.header_xml.enumtype.HorizontalAlign2;
import kr.dogfoot.hwpxlib.object.content.header_xml.enumtype.LineSpacingType;
import kr.dogfoot.hwpxlib.object.content.header_xml.enumtype.ValueUnit2;
import kr.dogfoot.hwpxlib.object.content.header_xml.references.CharPr;
import kr.dogfoot.hwpxlib.object.content.header_xml.references.ParaPr;
import kr.dogfoot.hwpxlib.object.content.section_xml.SectionXMLFile;
import kr.dogfoot.hwpxlib.object.content.section_xml.paragraph.Para;
import kr.dogfoot.hwpxlib.object.content.section_xml.paragraph.Run;
import kr.dogfoot.hwpxlib.object.content.section_xml.paragraph.RunItem;
import kr.dogfoot.hwpxlib.object.content.section_xml.paragraph.T;
import kr.dogfoot.hwpxlib.reader.HWPXReader;
import kr.dogfoot.hwpxlib.tool.blankfilemaker.BlankFileMaker;
import kr.dogfoot.hwpxlib.writer.HWPXWriter;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.InputStream;
import java.nio.file.Files;
import java.util.*;

/**
 * HwpxService — HWPX 파싱/저장/내보내기 (hwpxlib 1.0.8 정확한 API)
 *
 * ObjectList API:
 *   .count()    → 크기
 *   .get(int)   → 인덱스 접근
 *   .items()    → Iterable (for-each)
 *   .addNew()   → 새 항목 추가 후 반환
 *   .remove(int)
 *   .removeAll()
 *
 * HorizontalAlign2 enum: JUSTIFY, LEFT, RIGHT, CENTER, DISTRIBUTE (대문자)
 * ValuesByLanguage.setAll(v) → 모든 언어에 동일값 설정
 */
@Service
public class HwpxService {

    // ══════════════════════════════════════════════════════════════════════
    //  Parse HWPX → JSON model
    // ══════════════════════════════════════════════════════════════════════

    public Map<String, Object> parseHwpx(MultipartFile file) throws Exception {
        File temp = File.createTempFile("hc_hwpx_", ".hwpx");
        try {
            file.transferTo(temp);
            HWPXFile hwpx = HWPXReader.fromFile(temp);
            return buildModel(hwpx, file.getOriginalFilename());
        } finally {
            temp.delete();
        }
    }

    public Map<String, Object> parseHwpxFromBytes(byte[] bytes, String title) throws Exception {
        File temp = File.createTempFile("hc_hwpx_", ".hwpx");
        try {
            Files.write(temp.toPath(), bytes);
            HWPXFile hwpx = HWPXReader.fromFile(temp);
            return buildModel(hwpx, title);
        } finally {
            temp.delete();
        }
    }

    private Map<String, Object> buildModel(HWPXFile hwpx, String title) throws Exception {
        List<Map<String, Object>> sections = new ArrayList<>();

        ObjectList<SectionXMLFile> secList = hwpx.sectionXMLFileList();
        for (int si = 0; si < secList.count(); si++) {
            SectionXMLFile sec = secList.get(si);
            List<Map<String, Object>> paragraphs = new ArrayList<>();
            for (Para para : sec.paras()) {
                paragraphs.add(extractPara(hwpx, para));
            }
            Map<String, Object> secMap = new LinkedHashMap<>();
            secMap.put("paragraphs", paragraphs);
            sections.add(secMap);
        }

        Map<String, Object> model = new LinkedHashMap<>();
        model.put("title",        title);
        model.put("format",       "hwpx");
        model.put("fileType",     "hwpx");
        model.put("sectionCount", sections.size());
        model.put("sections",     sections);
        return model;
    }

    private Map<String, Object> extractPara(HWPXFile hwpx, Para para) {
        StringBuilder textBuf = new StringBuilder();
        for (Run run : para.runs()) {
            for (int i = 0; i < run.countOfRunItem(); i++) {
                RunItem item = run.getRunItem(i);
                if (item instanceof T t && t.isOnlyText()) {
                    textBuf.append(t.onlyText());
                }
            }
        }

        // Defaults
        String  fontName   = "NanumGothic";
        int     fontSize   = 10;
        boolean bold       = false;
        boolean italic     = false;
        boolean underline  = false;
        boolean strike     = false;
        boolean sup        = false;
        boolean sub        = false;
        String  color      = "#000000";
        double  letterSpc  = 0.0;
        int     scaleX     = 100;
        String  align      = "left";
        double  lineSpace  = 1.6;
        double  spaceBefore = 0;
        double  spaceAfter  = 0;

        try {
            if (para.countOfRun() > 0) {
                String cpRef = para.getRun(0).charPrIDRef();
                if (cpRef != null && hwpx.headerXMLFile().refList() != null) {
                    ObjectList<CharPr> cpList = hwpx.headerXMLFile().refList().charProperties();
                    if (cpList != null) {
                        for (CharPr cp : cpList.items()) {
                            if (cpRef.equals(cp.id())) {
                                if (cp.height()    != null) fontSize = cp.height() / 100;
                                if (cp.textColor() != null) color    = "#" + cp.textColor();
                                bold     = cp.bold()      != null;
                                italic   = cp.italic()    != null;
                                underline = cp.underline() != null;
                                strike   = cp.strikeout() != null;
                                sup      = cp.supscript() != null;
                                sub      = cp.subscript() != null;
                                if (cp.fontRef() != null && cp.fontRef().hangul() != null)
                                    fontName = cp.fontRef().hangul();
                                if (cp.spacing() != null && cp.spacing().hangul() != null)
                                    letterSpc = cp.spacing().hangul() / 100.0;
                                if (cp.ratio()   != null && cp.ratio().hangul()   != null)
                                    scaleX = cp.ratio().hangul();
                                break;
                            }
                        }
                    }
                }
            }
        } catch (Exception ignored) {}

        try {
            String ppRef = para.paraPrIDRef();
            if (ppRef != null && hwpx.headerXMLFile().refList() != null) {
                ObjectList<ParaPr> ppList = hwpx.headerXMLFile().refList().paraProperties();
                if (ppList != null) {
                    for (ParaPr pp : ppList.items()) {
                        if (ppRef.equals(pp.id())) {
                            if (pp.align() != null && pp.align().horizontal() != null)
                                align = toAlignStr(pp.align().horizontal());
                            if (pp.lineSpacing() != null && pp.lineSpacing().value() != null)
                                lineSpace = pp.lineSpacing().value() / 100.0;
                            if (pp.margin() != null) {
                                if (pp.margin().prev() != null && pp.margin().prev().value() != null)
                                    spaceBefore = pp.margin().prev().value() / 100.0;
                                if (pp.margin().next() != null && pp.margin().next().value() != null)
                                    spaceAfter  = pp.margin().next().value() / 100.0;
                            }
                            break;
                        }
                    }
                }
            }
        } catch (Exception ignored) {}

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("text",                   textBuf.toString());
        m.put("fontName",               fontName);
        m.put("fontSize",               fontSize);
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
        return m;
    }

    private String toAlignStr(HorizontalAlign2 h) {
        if (h == null) return "left";
        return switch (h.name()) {
            case "CENTER"     -> "center";
            case "RIGHT"      -> "right";
            case "JUSTIFY"    -> "justify";
            case "DISTRIBUTE", "DISTRIBUTE_SPACE" -> "distribute";
            default           -> "left";
        };
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Export HWPX bytes from JSON model (새 파일 생성)
    // ══════════════════════════════════════════════════════════════════════

    @SuppressWarnings("unchecked")
    public byte[] exportToHwpx(Map<String, Object> docModel) throws Exception {
        HWPXFile hwpx = BlankFileMaker.make();

        List<Map<String, Object>> sections =
                (List<Map<String, Object>>) docModel.get("sections");
        if (sections == null || sections.isEmpty()) {
            return HWPXWriter.toBytes(hwpx);
        }

        // Clear existing blank sections
        hwpx.sectionXMLFileList().removeAll();

        // Ensure refList structures exist
        ensureRefLists(hwpx);

        int cpIdx = 1, ppIdx = 1;
        for (Map<String, Object> secData : sections) {
            SectionXMLFile sec = hwpx.sectionXMLFileList().addNew();
            List<Map<String, Object>> paras = (List<Map<String, Object>>) secData.get("paragraphs");
            if (paras == null) continue;

            for (Map<String, Object> pData : paras) {
                Para para = sec.addNewPara();

                String cpId = "cp" + cpIdx++;
                CharPr cp = hwpx.headerXMLFile().refList().charProperties().addNew();
                cp.id(cpId);
                applyCharPr(cp, pData);

                String ppId = "pp" + ppIdx++;
                ParaPr pp = hwpx.headerXMLFile().refList().paraProperties().addNew();
                pp.id(ppId);
                applyParaPr(pp, pData);

                para.paraPrIDRef(ppId);
                Run run = para.addNewRun();
                run.charPrIDRef(cpId);
                T t = run.addNewT();
                t.addText(pData.get("text") instanceof String s ? s : "");
            }
        }

        return HWPXWriter.toBytes(hwpx);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Save HWPX — preserve structure, update content + formatting
    // ══════════════════════════════════════════════════════════════════════

    @SuppressWarnings("unchecked")
    public byte[] saveHwpx(byte[] originalBytes, Map<String, Object> docModel) throws Exception {
        File temp = File.createTempFile("hc_hwpx_orig_", ".hwpx");
        try {
            Files.write(temp.toPath(), originalBytes);
            HWPXFile hwpx = HWPXReader.fromFile(temp);

            List<Map<String, Object>> sections =
                    (List<Map<String, Object>>) docModel.get("sections");
            if (sections == null) return HWPXWriter.toBytes(hwpx);

            ensureRefLists(hwpx);

            int secIdx = 0;
            for (int si = 0; si < hwpx.sectionXMLFileList().count() && si < sections.size(); si++) {
                SectionXMLFile sec = hwpx.sectionXMLFileList().get(si);
                List<Map<String, Object>> parasData =
                        (List<Map<String, Object>>) sections.get(si).get("paragraphs");
                if (parasData == null) continue;

                int paraIdx = 0;
                for (Para para : sec.paras()) {
                    if (paraIdx >= parasData.size()) break;
                    Map<String, Object> pData = parasData.get(paraIdx);

                    para.removeAllRuns();

                    String cpId = "cp_s" + si + "_p" + paraIdx;
                    String ppId = "pp_s" + si + "_p" + paraIdx;

                    CharPr cp = findOrCreateCharPr(hwpx, cpId);
                    applyCharPr(cp, pData);

                    ParaPr pp = findOrCreateParaPr(hwpx, ppId);
                    applyParaPr(pp, pData);

                    para.paraPrIDRef(ppId);
                    Run run = para.addNewRun();
                    run.charPrIDRef(cpId);
                    T t = run.addNewT();
                    t.addText(pData.get("text") instanceof String s ? s : "");

                    paraIdx++;
                }
            }

            return HWPXWriter.toBytes(hwpx);
        } finally {
            temp.delete();
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  CharPr — apply character formatting
    // ══════════════════════════════════════════════════════════════════════

    private void applyCharPr(CharPr cp, Map<String, Object> d) {
        int fontSize = d.get("fontSize") instanceof Number n ? n.intValue() : 10;
        cp.height(fontSize * 100);  // 1/100pt

        // Boolean flags: presence = true
        if (Boolean.TRUE.equals(d.get("bold")))          cp.createBold();        else cp.removeBold();
        if (Boolean.TRUE.equals(d.get("italic")))        cp.createItalic();      else cp.removeItalic();
        if (Boolean.TRUE.equals(d.get("underline")))     cp.createUnderline();   else cp.removeUnderline();
        if (Boolean.TRUE.equals(d.get("strikethrough"))) cp.createStrikeout();   else cp.removeStrikeout();
        if (Boolean.TRUE.equals(d.get("superscript")))   cp.createSupscript();   else cp.removeSupscript();
        if (Boolean.TRUE.equals(d.get("subscript")))     cp.createSubscript();   else cp.removeSubscript();

        // Text color: RRGGBB string (without #)
        if (d.get("textColor") instanceof String tc && tc.startsWith("#") && tc.length() == 7) {
            cp.textColor(tc.substring(1).toUpperCase());
        }

        // Font name (all language slots via setAll)
        String fontName = d.get("fontName") instanceof String fn && !fn.isBlank() ? fn : "NanumGothic";
        if (cp.fontRef() == null) cp.createFontRef();
        cp.fontRef().setAll(fontName);

        // Letter spacing (자간): ValuesByLanguage<Short>.setAll(short)
        if (d.get("letterSpacing") instanceof Number ls && ls.doubleValue() != 0.0) {
            if (cp.spacing() == null) cp.createSpacing();
            short spc = (short) Math.max(-50, Math.min(50, (int)(ls.doubleValue() * 100)));
            cp.spacing().setAll(spc);
        }

        // Text scale X (장평): ValuesByLanguage<Short>.setAll(short)
        if (d.get("textScaleX") instanceof Number sx && sx.intValue() != 100) {
            if (cp.ratio() == null) cp.createRatio();
            short r = (short) Math.max(50, Math.min(200, sx.intValue()));
            cp.ratio().setAll(r);
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  ParaPr — apply paragraph formatting
    // ══════════════════════════════════════════════════════════════════════

    private void applyParaPr(ParaPr pp, Map<String, Object> d) {
        // Alignment: HorizontalAlign2 enum is uppercase (CENTER, RIGHT, etc.)
        if (d.get("align") instanceof String align) {
            if (pp.align() == null) pp.createAlign();
            HorizontalAlign2 h = switch (align) {
                case "center"     -> HorizontalAlign2.CENTER;
                case "right"      -> HorizontalAlign2.RIGHT;
                case "justify"    -> HorizontalAlign2.JUSTIFY;
                case "distribute" -> HorizontalAlign2.DISTRIBUTE;
                default           -> HorizontalAlign2.LEFT;
            };
            pp.align().horizontal(h);
        }

        // Line spacing (%) × 100 stored as integer
        if (d.get("lineSpacing") instanceof Number ls) {
            if (pp.lineSpacing() == null) pp.createLineSpacing();
            pp.lineSpacing().type(LineSpacingType.PERCENT);
            pp.lineSpacing().value((int)(ls.doubleValue() * 100));
            pp.lineSpacing().unit(ValueUnit2.HWPUNIT);
        }

        // Paragraph spacing (1/100 mm)
        if (d.get("paragraphSpacingBefore") instanceof Number sb && sb.doubleValue() != 0) {
            if (pp.margin() == null) pp.createMargin();
            pp.margin().createPrev();
            pp.margin().prev().value((int)(sb.doubleValue() * 100));
        }
        if (d.get("paragraphSpacingAfter") instanceof Number sa && sa.doubleValue() != 0) {
            if (pp.margin() == null) pp.createMargin();
            pp.margin().createNext();
            pp.margin().next().value((int)(sa.doubleValue() * 100));
        }

        // Indent
        if (d.get("indent") instanceof Number ind && ind.intValue() > 0) {
            if (pp.margin() == null) pp.createMargin();
            pp.margin().createIntent();
            pp.margin().intent().value(ind.intValue() * 1000);
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Helpers
    // ══════════════════════════════════════════════════════════════════════

    private void ensureRefLists(HWPXFile hwpx) {
        if (hwpx.headerXMLFile().refList() == null)
            hwpx.headerXMLFile().createRefList();
        if (hwpx.headerXMLFile().refList().charProperties() == null)
            hwpx.headerXMLFile().refList().createCharProperties();
        if (hwpx.headerXMLFile().refList().paraProperties() == null)
            hwpx.headerXMLFile().refList().createParaProperties();
    }

    private CharPr findOrCreateCharPr(HWPXFile hwpx, String id) {
        ObjectList<CharPr> list = hwpx.headerXMLFile().refList().charProperties();
        for (CharPr cp : list.items()) {
            if (id.equals(cp.id())) return cp;
        }
        CharPr cp = list.addNew();
        cp.id(id);
        return cp;
    }

    private ParaPr findOrCreateParaPr(HWPXFile hwpx, String id) {
        ObjectList<ParaPr> list = hwpx.headerXMLFile().refList().paraProperties();
        for (ParaPr pp : list.items()) {
            if (id.equals(pp.id())) return pp;
        }
        ParaPr pp = list.addNew();
        pp.id(id);
        return pp;
    }
}
