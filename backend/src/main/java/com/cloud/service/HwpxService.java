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
import java.nio.file.Files;
import java.util.*;

/**
 * HwpxService — hwpxlib 1.0.8 기반 HWPX 완전 읽기/쓰기/내보내기
 *
 * IDE 호환 주의사항:
 *  - ObjectList는 Iterable을 직접 구현하지 않으므로 for-each 금지
 *    → count() + get(int) 인덱스 루프 사용
 *  - HorizontalAlign2 enum: CENTER, RIGHT, JUSTIFY, DISTRIBUTE, LEFT (대문자)
 *  - ValuesByLanguage.setAll() (setForAll 아님)
 *  - LineSpacingType.PERCENT, ValueUnit2.HWPUNIT
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
            return buildModel(HWPXReader.fromFile(temp), file.getOriginalFilename());
        } finally {
            temp.delete();
        }
    }

    public Map<String, Object> parseHwpxFromBytes(byte[] bytes, String title) throws Exception {
        File temp = File.createTempFile("hc_hwpx_b_", ".hwpx");
        try {
            Files.write(temp.toPath(), bytes);
            return buildModel(HWPXReader.fromFile(temp), title);
        } finally {
            temp.delete();
        }
    }

    private Map<String, Object> buildModel(HWPXFile hwpx, String title) {
        List<Map<String, Object>> sections = new ArrayList<>();

        // ObjectList: use count() + get(int) — not Iterable
        ObjectList<SectionXMLFile> secList = hwpx.sectionXMLFileList();
        for (int si = 0; si < secList.count(); si++) {
            SectionXMLFile sec = secList.get(si);
            List<Map<String, Object>> paragraphs = new ArrayList<>();
            // Para: ParaListCore.countOfPara() + getPara(int)
            for (int pi = 0; pi < sec.countOfPara(); pi++) {
                paragraphs.add(extractPara(hwpx, sec.getPara(pi)));
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
        // Collect text
        StringBuilder sb = new StringBuilder();
        for (int ri = 0; ri < para.countOfRun(); ri++) {
            Run run = para.getRun(ri);
            for (int ti = 0; ti < run.countOfRunItem(); ti++) {
                RunItem item = run.getRunItem(ti);
                if (item instanceof T t && t.isOnlyText()) sb.append(t.onlyText());
            }
        }

        // Defaults
        String  fontName    = "NanumGothic";
        int     fontSize    = 10;
        boolean bold        = false, italic = false, underline = false;
        boolean strike      = false, sup    = false, sub       = false;
        String  color       = "#000000";
        double  letterSpc   = 0.0;
        int     scaleX      = 100;
        String  align       = "left";
        double  lineSpace   = 1.6;
        double  spaceBefore = 0, spaceAfter = 0;

        try {
            if (para.countOfRun() > 0) {
                String cpRef = para.getRun(0).charPrIDRef();
                if (cpRef != null && hwpx.headerXMLFile().refList() != null) {
                    ObjectList<CharPr> cpList = hwpx.headerXMLFile().refList().charProperties();
                    if (cpList != null) {
                        for (int i = 0; i < cpList.count(); i++) {
                            CharPr cp = cpList.get(i);
                            if (cpRef.equals(cp.id())) {
                                if (cp.height()    != null) fontSize  = cp.height() / 100;
                                if (cp.textColor() != null) color     = "#" + cp.textColor();
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
                    for (int i = 0; i < ppList.count(); i++) {
                        ParaPr pp = ppList.get(i);
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
        m.put("text",                   sb.toString());
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

    /** HorizontalAlign2 enum은 이름 기반 switch 사용 (대문자) */
    private String toAlignStr(HorizontalAlign2 h) {
        if (h == null) return "left";
        switch (h) {
            case CENTER:           return "center";
            case RIGHT:            return "right";
            case JUSTIFY:          return "justify";
            case DISTRIBUTE:
            case DISTRIBUTE_SPACE: return "distribute";
            default:               return "left";
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Export HWPX bytes from JSON model (BlankFileMaker 신규 생성)
    // ══════════════════════════════════════════════════════════════════════

    @SuppressWarnings("unchecked")
    public byte[] exportToHwpx(Map<String, Object> docModel) throws Exception {
        HWPXFile hwpx = BlankFileMaker.make();
        ensureRefLists(hwpx);

        List<Map<String, Object>> sections = (List<Map<String, Object>>) docModel.get("sections");
        if (sections == null || sections.isEmpty()) return HWPXWriter.toBytes(hwpx);

        // Clear blank sections added by BlankFileMaker
        ObjectList<SectionXMLFile> secList = hwpx.sectionXMLFileList();
        while (secList.count() > 0) secList.remove(0);

        int cpIdx = 1, ppIdx = 1;
        for (Map<String, Object> secData : sections) {
            SectionXMLFile sec = secList.addNew();
            List<Map<String, Object>> paras = (List<Map<String, Object>>) secData.get("paragraphs");
            if (paras == null) continue;
            for (Map<String, Object> pData : paras) {
                String cpId = "cp" + cpIdx++;
                CharPr cp = hwpx.headerXMLFile().refList().charProperties().addNew();
                cp.id(cpId);
                applyCharPr(cp, pData);

                String ppId = "pp" + ppIdx++;
                ParaPr pp = hwpx.headerXMLFile().refList().paraProperties().addNew();
                pp.id(ppId);
                applyParaPr(pp, pData);

                Para para = sec.addNewPara();
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
    //  Save HWPX — 원본 유지하며 내용+서식 업데이트
    // ══════════════════════════════════════════════════════════════════════

    @SuppressWarnings("unchecked")
    public byte[] saveHwpx(byte[] originalBytes, Map<String, Object> docModel) throws Exception {
        File temp = File.createTempFile("hc_hwpx_orig_", ".hwpx");
        try {
            Files.write(temp.toPath(), originalBytes);
            HWPXFile hwpx = HWPXReader.fromFile(temp);
            ensureRefLists(hwpx);

            List<Map<String, Object>> sections = (List<Map<String, Object>>) docModel.get("sections");
            if (sections == null) return HWPXWriter.toBytes(hwpx);

            ObjectList<SectionXMLFile> secList = hwpx.sectionXMLFileList();
            for (int si = 0; si < secList.count() && si < sections.size(); si++) {
                SectionXMLFile sec = secList.get(si);
                List<Map<String, Object>> parasData = (List<Map<String, Object>>) sections.get(si).get("paragraphs");
                if (parasData == null) continue;

                for (int pi = 0; pi < sec.countOfPara() && pi < parasData.size(); pi++) {
                    Para para = sec.getPara(pi);
                    Map<String, Object> pData = parasData.get(pi);

                    // Paragraph-level properties: use a stable per-paragraph ParaPr (doesn't delete original structures)
                    String ppId = "pp_s" + si + "_p" + pi;
                    ParaPr pp = findOrCreateParaPr(hwpx, ppId);
                    applyParaPr(pp, pData);
                    para.paraPrIDRef(ppId);

                    // Find first plain-text T item and update it. Do NOT remove runs (preserve pictures/objects).
                    Run targetRun = null;
                    T targetT = null;

                    for (int ri = 0; ri < para.countOfRun(); ri++) {
                        Run run = para.getRun(ri);
                        for (int ti = 0; ti < run.countOfRunItem(); ti++) {
                            RunItem item = run.getRunItem(ti);
                            if (item instanceof T t && t.isOnlyText()) {
                                if (targetT == null) {
                                    targetRun = run;
                                    targetT = t;
                                }
                            }
                        }
                    }

                    if (targetRun == null) {
                        // No runs exist or no plain-text item found → create a new run + T
                        targetRun = para.addNewRun();
                        targetT = targetRun.addNewT();
                    }

                    // Clear all plain-text items to avoid duplicates, then set new text on the first target.
                    for (int ri = 0; ri < para.countOfRun(); ri++) {
                        Run run = para.getRun(ri);
                        for (int ti = 0; ti < run.countOfRunItem(); ti++) {
                            RunItem item = run.getRunItem(ti);
                            if (item instanceof T t && t.isOnlyText()) {
                                t.clear();
                            }
                        }
                    }
                    String newText = pData.get("text") instanceof String s ? s : "";
                    targetT.addText(newText);

                    // Character properties: apply to the target run only (preserve other runs' styling)
                    String cpId = "cp_s" + si + "_p" + pi;
                    CharPr cp = findOrCreateCharPr(hwpx, cpId);
                    applyCharPr(cp, pData);
                    targetRun.charPrIDRef(cpId);
                }
            }
            return HWPXWriter.toBytes(hwpx);
        } finally {
            temp.delete();
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  CharPr 서식 적용
    // ══════════════════════════════════════════════════════════════════════

    private void applyCharPr(CharPr cp, Map<String, Object> d) {
        int fontSize = d.get("fontSize") instanceof Number n ? n.intValue() : 10;
        cp.height(fontSize * 100);  // 1/100 pt

        if (Boolean.TRUE.equals(d.get("bold")))          cp.createBold();      else cp.removeBold();
        if (Boolean.TRUE.equals(d.get("italic")))        cp.createItalic();    else cp.removeItalic();
        if (Boolean.TRUE.equals(d.get("underline")))     cp.createUnderline(); else cp.removeUnderline();
        if (Boolean.TRUE.equals(d.get("strikethrough"))) cp.createStrikeout(); else cp.removeStrikeout();
        if (Boolean.TRUE.equals(d.get("superscript")))   cp.createSupscript(); else cp.removeSupscript();
        if (Boolean.TRUE.equals(d.get("subscript")))     cp.createSubscript(); else cp.removeSubscript();

        if (d.get("textColor") instanceof String tc && tc.startsWith("#") && tc.length() == 7)
            cp.textColor(tc.substring(1).toUpperCase());

        String fontName = d.get("fontName") instanceof String fn && !fn.isBlank() ? fn : "NanumGothic";
        if (cp.fontRef() == null) cp.createFontRef();
        cp.fontRef().setAll(fontName);  // setAll() — not setForAll()

        if (d.get("letterSpacing") instanceof Number ls && ls.doubleValue() != 0.0) {
            if (cp.spacing() == null) cp.createSpacing();
            short spc = (short) Math.max(-50, Math.min(50, (int)(ls.doubleValue() * 100)));
            cp.spacing().setAll(spc);  // ValuesByLanguage<Short>.setAll(Short)
        }

        if (d.get("textScaleX") instanceof Number sx && sx.intValue() != 100) {
            if (cp.ratio() == null) cp.createRatio();
            short r = (short) Math.max(50, Math.min(200, sx.intValue()));
            cp.ratio().setAll(r);
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  ParaPr 서식 적용
    // ══════════════════════════════════════════════════════════════════════

    private void applyParaPr(ParaPr pp, Map<String, Object> d) {
        if (d.get("align") instanceof String align) {
            if (pp.align() == null) pp.createAlign();
            // HorizontalAlign2: CENTER, RIGHT, JUSTIFY, DISTRIBUTE, LEFT (대문자)
            HorizontalAlign2 h;
            switch (align) {
                case "center":     h = HorizontalAlign2.CENTER;     break;
                case "right":      h = HorizontalAlign2.RIGHT;      break;
                case "justify":    h = HorizontalAlign2.JUSTIFY;    break;
                case "distribute": h = HorizontalAlign2.DISTRIBUTE; break;
                default:           h = HorizontalAlign2.LEFT;       break;
            }
            pp.align().horizontal(h);
        }

        if (d.get("lineSpacing") instanceof Number ls) {
            if (pp.lineSpacing() == null) pp.createLineSpacing();
            pp.lineSpacing().type(LineSpacingType.PERCENT);       // PERCENT (not PERCENT_LINE_HEIGHT)
            pp.lineSpacing().value((int)(ls.doubleValue() * 100));
            pp.lineSpacing().unit(ValueUnit2.HWPUNIT);            // HWPUNIT (not PERCENT)
        }

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
        if (hwpx.headerXMLFile().refList() == null) hwpx.headerXMLFile().createRefList();
        if (hwpx.headerXMLFile().refList().charProperties() == null)
            hwpx.headerXMLFile().refList().createCharProperties();
        if (hwpx.headerXMLFile().refList().paraProperties() == null)
            hwpx.headerXMLFile().refList().createParaProperties();
    }

    private CharPr findOrCreateCharPr(HWPXFile hwpx, String id) {
        ObjectList<CharPr> list = hwpx.headerXMLFile().refList().charProperties();
        for (int i = 0; i < list.count(); i++) {
            if (id.equals(list.get(i).id())) return list.get(i);
        }
        CharPr cp = list.addNew(); cp.id(id); return cp;
    }

    private ParaPr findOrCreateParaPr(HWPXFile hwpx, String id) {
        ObjectList<ParaPr> list = hwpx.headerXMLFile().refList().paraProperties();
        for (int i = 0; i < list.count(); i++) {
            if (id.equals(list.get(i).id())) return list.get(i);
        }
        ParaPr pp = list.addNew(); pp.id(id); return pp;
    }
}
