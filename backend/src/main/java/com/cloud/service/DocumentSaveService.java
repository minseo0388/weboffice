package com.cloud.service;

import com.cloud.model.UserPrincipal;
import kr.dogfoot.hwplib.object.HWPFile;
import kr.dogfoot.hwplib.object.bodytext.Section;
import kr.dogfoot.hwplib.object.bodytext.paragraph.Paragraph;
import kr.dogfoot.hwplib.object.bodytext.paragraph.charshape.CharPositionShapeIdPair;
import kr.dogfoot.hwplib.object.bodytext.paragraph.charshape.ParaCharShape;
import kr.dogfoot.hwplib.object.bodytext.paragraph.text.HWPCharNormal;
import kr.dogfoot.hwplib.object.bodytext.paragraph.text.ParaText;
import kr.dogfoot.hwplib.object.docinfo.CharShape;
import kr.dogfoot.hwplib.object.docinfo.DocInfo;
import kr.dogfoot.hwplib.object.docinfo.FaceName;
import kr.dogfoot.hwplib.object.docinfo.ParaShape;
import kr.dogfoot.hwplib.object.docinfo.charshape.CharShapeProperty;
import kr.dogfoot.hwplib.object.docinfo.charshape.CharSpaces;
import kr.dogfoot.hwplib.object.docinfo.charshape.FaceNameIds;
import kr.dogfoot.hwplib.object.docinfo.charshape.Ratios;
import kr.dogfoot.hwplib.object.docinfo.charshape.UnderLineSort;
import kr.dogfoot.hwplib.object.docinfo.parashape.Alignment;
import kr.dogfoot.hwplib.object.etc.Color4Byte;
import kr.dogfoot.hwplib.reader.HWPReader;
import kr.dogfoot.hwplib.writer.HWPWriter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.Files;
import java.util.*;

/**
 * HWPX 전체 서식 저장 서비스 (hwplib 1.1.9 정확한 API 사용)
 *
 * CharShape 매핑:
 *   bold/italic         → CharShapeProperty.setBold/setItalic
 *   underline           → CharShapeProperty.setUnderLineSort(UnderLineSort)
 *   strikethrough       → CharShapeProperty.setStrikeLine(boolean)
 *   superscript/sub     → CharShapeProperty.setSuperScript/setSubScript
 *   fontSize (pt)       → CharShape.setBaseSize(pt × 100)
 *   fontName            → DocInfo face name lists + FaceNameIds.setForAll
 *   textColor           → CharShape.getCharColor().setR/G/B
 *   letterSpacing (자간)  → CharSpaces.setForAll(byte, -50~50)
 *   textScaleX (장평)     → Ratios.setForAll(short, 50~200)
 *
 * ParaShape 매핑:
 *   align               → ParaShapeProperty1.setAlignment(Alignment)
 *   lineSpacing (%)     → ParaShape.setLineSpace(pct)
 *   paragraphSpacing    → ParaShape.setTopParaSpace / setBottomParaSpace
 *   indent              → ParaShape.setIndent (1/100 mm)
 */
@Service
public class DocumentSaveService {

    @Autowired
    private StorageService storageService;

    public record DocumentSaveRequest(
            String fileName,
            List<Map<String, Object>> sections
    ) {}

    public record DocumentSaveResponse(
            String fileName,
            boolean success,
            String message,
            long savedBytes
    ) {}

    // ══════════════════════════════════════════════════════════════════════

    public DocumentSaveResponse saveDocument(UserPrincipal user, DocumentSaveRequest request) throws Exception {
        String fileName = request.fileName();
        String format   = fileName.toLowerCase().endsWith(".hwpx") ? "hwpx" : "hwp";

        InputStream originalStream = storageService.downloadFile(user, fileName);
        File tempOriginal = File.createTempFile("hwp_orig_", "." + format);
        Files.copy(originalStream, tempOriginal.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);

        try {
            HWPFile hwpFile = HWPReader.fromFile(tempOriginal.getAbsolutePath());
            if (hwpFile == null) throw new IllegalStateException("Failed to parse: " + fileName);

            applyAll(hwpFile, request.sections());

            File tempOut = File.createTempFile("hwp_out_", "." + format);
            HWPWriter.toFile(hwpFile, tempOut.getAbsolutePath());

            byte[] bytes = Files.readAllBytes(tempOut.toPath());
            storageService.uploadFile(user, fileName, bytes);
            tempOut.delete();

            return new DocumentSaveResponse(fileName, true, "저장 완료.", bytes.length);
        } finally {
            tempOriginal.delete();
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Apply all
    // ══════════════════════════════════════════════════════════════════════

    @SuppressWarnings("unchecked")
    private void applyAll(HWPFile hwpFile, List<Map<String, Object>> sectionsList) {
        List<Section> bodySections = hwpFile.getBodyText().getSectionList();

        for (int si = 0; si < Math.min(sectionsList.size(), bodySections.size()); si++) {
            Section sec   = bodySections.get(si);
            var secData   = sectionsList.get(si);
            var parasData = (List<Map<String, Object>>) secData.get("paragraphs");
            if (parasData == null) continue;

            for (int pi = 0; pi < Math.min(parasData.size(), sec.getParagraphCount()); pi++) {
                Paragraph para  = sec.getParagraph(pi);
                var       pData = parasData.get(pi);

                if (pData.get("text") instanceof String t) updateText(para, t);
                applyCharShape(hwpFile, para, pData);
                applyParaShape(hwpFile, para, pData);
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  CharShape — character-level formatting
    // ══════════════════════════════════════════════════════════════════════

    private void applyCharShape(HWPFile hwpFile, Paragraph para, Map<String, Object> d) {
        try {
            ParaCharShape pcs = para.getCharShape();
            if (pcs == null) return;

            List<CharPositionShapeIdPair> pairs = pcs.getPositonShapeIdPairList();
            if (pairs == null || pairs.isEmpty()) return;

            // ── Extract JSON values ──────────────────────────────────────
            boolean bold          = Boolean.TRUE.equals(d.get("bold"));
            boolean italic        = Boolean.TRUE.equals(d.get("italic"));
            boolean underline     = Boolean.TRUE.equals(d.get("underline"));
            boolean strikethrough = Boolean.TRUE.equals(d.get("strikethrough"));
            boolean superscript   = Boolean.TRUE.equals(d.get("superscript"));
            boolean subscript     = Boolean.TRUE.equals(d.get("subscript"));
            int     fontSize      = d.get("fontSize")      instanceof Number n  ? n.intValue()  : -1;
            String  fontName      = d.get("fontName")      instanceof String fn && !fn.isBlank() ? fn : null;
            String  textColor     = d.get("textColor")     instanceof String tc ? tc : null;
            double  letterSpc     = d.get("letterSpacing") instanceof Number ls ? ls.doubleValue() : Double.NaN;
            int     scaleX        = d.get("textScaleX")    instanceof Number sx ? sx.intValue()    : -1;

            DocInfo docInfo  = hwpFile.getDocInfo();
            List<CharShape> csList = docInfo.getCharShapeList();

            // Apply to all char shape entries in this paragraph
            for (CharPositionShapeIdPair pair : pairs) {
                int csIdx = (int) pair.getShapeId();
                if (csIdx < 0 || csIdx >= csList.size()) continue;

                CharShape cs = csList.get(csIdx);

                // ── CharShapeProperty ────────────────────────────────────
                CharShapeProperty prop = cs.getProperty();
                if (prop != null) {
                    prop.setBold(bold);
                    prop.setItalic(italic);
                    prop.setUnderLineSort(underline ? UnderLineSort.Bottom : UnderLineSort.None);
                    prop.setStrikeLine(strikethrough);
                    prop.setSuperScript(superscript);
                    prop.setSubScript(subscript);
                }

                // ── Font size: baseSize = pt × 100 ───────────────────────
                if (fontSize > 0) {
                    cs.setBaseSize(fontSize * 100);
                }

                // ── Font name (Hangul + English lists) ───────────────────
                if (fontName != null) {
                    int hangulIdx = getOrAddFaceName(docInfo.getHangulFaceNameList(),
                            () -> docInfo.addNewHangulFaceName(), fontName);
                    int latinIdx  = getOrAddFaceName(docInfo.getEnglishFaceNameList(),
                            () -> docInfo.addNewEnglishFaceName(), fontName);
                    FaceNameIds fids = cs.getFaceNameIds();
                    if (fids != null) {
                        fids.setHangul(hangulIdx);
                        fids.setLatin(latinIdx);
                        fids.setHanja(hangulIdx);
                        fids.setJapanese(hangulIdx);
                        fids.setOther(latinIdx);
                        fids.setSymbol(latinIdx);
                        fids.setUser(latinIdx);
                    }
                }

                // ── Text color via Color4Byte ─────────────────────────────
                if (textColor != null && textColor.startsWith("#") && textColor.length() == 7) {
                    try {
                        short r = (short) Integer.parseInt(textColor.substring(1, 3), 16);
                        short g = (short) Integer.parseInt(textColor.substring(3, 5), 16);
                        short b = (short) Integer.parseInt(textColor.substring(5, 7), 16);
                        Color4Byte c = cs.getCharColor();
                        if (c != null) { c.setR(r); c.setG(g); c.setB(b); }
                    } catch (NumberFormatException ignored) {}
                }

                // ── Letter spacing (자간): CharSpaces byte -50~50 ───────────
                if (!Double.isNaN(letterSpc)) {
                    CharSpaces spaces = cs.getCharSpaces();
                    if (spaces != null) {
                        // letterSpacing from UI is in em (e.g. 0.1 = 10%)
                        // hwplib CharSpaces is in -50~50 (%)
                        byte spcByte = (byte) Math.max(-50, Math.min(50,
                                (int) Math.round(letterSpc * 100)));
                        spaces.setForAll(spcByte);
                    }
                }

                // ── Text scale X (장평): Ratios short 50~200 ─────────────────
                if (scaleX > 0) {
                    Ratios ratios = cs.getRatios();
                    if (ratios != null) {
                        short s = (short) Math.max(50, Math.min(200, scaleX));
                        ratios.setForAll(s);
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("[WARN] applyCharShape: " + e.getMessage());
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  ParaShape — paragraph-level formatting
    // ══════════════════════════════════════════════════════════════════════

    private void applyParaShape(HWPFile hwpFile, Paragraph para, Map<String, Object> d) {
        try {
            // ParaShape index is in paragraph header
            long psIdx = para.getHeader().getParaShapeId();
            List<ParaShape> psList = hwpFile.getDocInfo().getParaShapeList();
            if (psIdx < 0 || psIdx >= psList.size()) return;

            ParaShape ps = psList.get((int) psIdx);

            // Alignment
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

            // Line spacing: hwplib unit = percent (e.g. 160 for 160%)
            if (d.get("lineSpacing") instanceof Number ls) {
                ps.setLineSpace((int) (ls.doubleValue() * 100));
            }

            // Paragraph spacing: hwplib unit = 1/100 mm
            if (d.get("paragraphSpacingBefore") instanceof Number sb) {
                ps.setTopParaSpace((int) (sb.doubleValue() * 100));
            }
            if (d.get("paragraphSpacingAfter") instanceof Number sa) {
                ps.setBottomParaSpace((int) (sa.doubleValue() * 100));
            }

            // Indent: hwplib unit = 1/100 mm (1 level ≈ 10mm)
            if (d.get("indent") instanceof Number ind && ind.intValue() > 0) {
                ps.setIndent(ind.intValue() * 1000);
            }

        } catch (Exception e) {
            System.err.println("[WARN] applyParaShape: " + e.getMessage());
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Face name: find or add to a specific script list
    // ══════════════════════════════════════════════════════════════════════

    @FunctionalInterface
    interface FaceNameAdder { FaceName add(); }

    private int getOrAddFaceName(List<FaceName> list, FaceNameAdder adder, String fontName) {
        for (int i = 0; i < list.size(); i++) {
            if (fontName.equalsIgnoreCase(list.get(i).getName())) return i;
        }
        FaceName newFace = adder.add();
        newFace.setName(fontName);
        return list.size() - 1;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Text content update
    // ══════════════════════════════════════════════════════════════════════

    private void updateText(Paragraph paragraph, String newText) {
        try {
            ParaText textObj = paragraph.getText();
            if (textObj == null) return;
            try {
                java.lang.reflect.Field f = textObj.getClass().getDeclaredField("m_nCharList");
                f.setAccessible(true);
                @SuppressWarnings("unchecked")
                List<Object> charList = (List<Object>) f.get(textObj);
                if (charList != null) {
                    charList.clear();
                    for (char c : newText.toCharArray()) {
                        HWPCharNormal ch = new HWPCharNormal();
                        ch.setCode(c);
                        charList.add(ch);
                    }
                }
            } catch (NoSuchFieldException ignored) {
                System.err.println("[WARN] updateText: field m_nCharList not found.");
            }
        } catch (Exception e) {
            System.err.println("[WARN] updateText: " + e.getMessage());
        }
    }
}
