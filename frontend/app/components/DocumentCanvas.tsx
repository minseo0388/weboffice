'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import styles from './DocumentCanvas.module.css';
import {
  Paragraph, TextDocumentModel, TextToolAction,
  PAGE_SIZES, DEFAULT_PAGE_SETTINGS, PageSettings,
} from '../types/document';

interface DocumentCanvasProps {
  document: TextDocumentModel;
  onContentChange: (updatedModel: TextDocumentModel) => void;
}

export interface DocumentCanvasHandle {
  applyAction: (action: TextToolAction) => void;
}

interface EditState {
  sectionIdx: number;
  paraIdx: number;
  text: string;
}

/**
 * DocumentCanvas: Renders and allows editing of the document JSON model.
 * Supports live text editing with formatting toolbar.
 */
const DocumentCanvas = forwardRef<DocumentCanvasHandle, DocumentCanvasProps>(function DocumentCanvas(
  { document, onContentChange }: DocumentCanvasProps,
  ref
) {
  const [editState, setEditState] = useState<EditState | null>(null);
  const [fontSize, setFontSize] = useState(14);
  const [fontName, setFontName] = useState('NanumGothic');
  const textInputRef = useRef<HTMLInputElement>(null);
  const historyRef   = useRef<TextDocumentModel[]>([]);
  const futureRef    = useRef<TextDocumentModel[]>([]);

  // Cursor persistence
  const selectionRef = useRef<{ start: number | null; end: number | null }>({ start: null, end: null });

  // Helper: push to undo history
  const pushHistory = useCallback((model: TextDocumentModel) => {
    historyRef.current = [...historyRef.current.slice(-49), model];
    futureRef.current  = [];
  }, []);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, visible: true });
  }, []);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    if (contextMenu?.visible) {
      window.addEventListener('click', closeMenu);
      return () => window.removeEventListener('click', closeMenu);
    }
  }, [contextMenu?.visible]);

  const handleContextMenuAction = (action: string) => {
    // Phase 3 parity: "우클릭 시 '복사/붙여넣기', '표 속성', '셀 병합' 등이 담긴 전용 메뉴"
    console.log('Action triggered:', action);
    setContextMenu(null);
  };


  // Memoize document structure for performance
  const documentTitle = useMemo(() => document.title || 'Untitled Document', [document.title]);
  const sections = useMemo(() => document.sections || [], [document.sections]);

  /**
   * Handle paragraph click: select for editing
   */
  const handleParagraphClick = useCallback(
    (sectionIdx: number, paraIdx: number, para: Paragraph) => {
      setEditState({
        sectionIdx,
        paraIdx,
        text: para.text,
      });

      // Populate formatting toolbar
      setFontSize(para.fontSize || 14);
      setFontName(para.fontName || 'NanumGothic');

      // Focus input after render
      setTimeout(() => textInputRef.current?.focus(), 0);
    },
    []
  );

  /**
   * Handle text input change & auto-sync to trigger auto-save
   */
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    selectionRef.current = {
      start: e.target.selectionStart,
      end: e.target.selectionEnd,
    };
    const newText = e.target.value;
    setEditState((prev) => (prev ? { ...prev, text: newText } : null));

    if (editState) {
      const updatedSections = sections.map((section, sIdx) =>
        sIdx === editState.sectionIdx
          ? {
              ...section,
              paragraphs: section.paragraphs.map((para, pIdx) =>
                pIdx === editState.paraIdx
                  ? { ...para, text: newText, fontSize, fontName }
                  : para
              ),
            }
          : section
      );
      const next = { ...document, sections: updatedSections };
      onContentChange(next);
    }
  };

  // Restore cursor after re-render due to auto-save sync
  useEffect(() => {
    if (textInputRef.current && selectionRef.current.start !== null) {
      textInputRef.current.setSelectionRange(selectionRef.current.start, selectionRef.current.end);
    }
  });

  const handleSaveText = useCallback(() => {
    // onContentChange is now handled in handleTextChange to support real-time auto-save.
    // This just exits the edit state.
    setEditState(null);
  }, []);

  /**
   * Handle keyboard input in editor
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveText();
    } else if (e.key === 'Escape') {
      setEditState(null);
    }
  };

  const updateSelectedParagraph = useCallback((updater: (para: Paragraph) => Paragraph) => {
    if (!editState) return;
    const updatedSections = sections.map((section, sIdx) =>
      sIdx === editState.sectionIdx
        ? {
            ...section,
            paragraphs: section.paragraphs.map((para, pIdx) =>
              pIdx === editState.paraIdx
                ? updater(para)
                : para
            ),
          }
        : section
    );

    const updatedModel: TextDocumentModel = {
      ...document,
      sections: updatedSections,
    };

    onContentChange(updatedModel);
  }, [document, editState, onContentChange, sections]);

  useImperativeHandle(ref, () => ({
    applyAction: (action: TextToolAction) => {
      // ── Undo / Redo ───────────────────────────────────────────
      if (action.type === 'undo') {
        const prev = historyRef.current.pop();
        if (prev) { futureRef.current.push(document); onContentChange(prev); }
        return;
      }
      if (action.type === 'redo') {
        const next = futureRef.current.pop();
        if (next) { historyRef.current.push(document); onContentChange(next); }
        return;
      }

      // ── Add / Delete paragraph ────────────────────────────────
      if (action.type === 'addParagraph') {
        pushHistory(document);
        const newSections = sections.map((sec, si) => {
          if (si !== (editState?.sectionIdx ?? 0)) return sec;
          const insertIdx = (editState?.paraIdx ?? sec.paragraphs.length - 1) + 1;
          const newParas = [...sec.paragraphs];
          newParas.splice(insertIdx, 0, { text: '', fontSize: 11, fontName: 'NanumGothic' });
          return { ...sec, paragraphs: newParas };
        });
        onContentChange({ ...document, sections: newSections });
        return;
      }
      if (action.type === 'deleteParagraph' && editState) {
        pushHistory(document);
        const newSections = sections.map((sec, si) => {
          if (si !== editState.sectionIdx) return sec;
          const newParas = sec.paragraphs.filter((_, pi) => pi !== editState.paraIdx);
          return { ...sec, paragraphs: newParas.length > 0 ? newParas : [{ text: '' }] };
        });
        setEditState(null);
        onContentChange({ ...document, sections: newSections });
        return;
      }

      // ── Insert Table ──────────────────────────────────────────
      if (action.type === 'insertTable') {
        pushHistory(document);
        const tableText = Array.from({ length: action.rows }, (_, r) =>
          Array.from({ length: action.cols }, (_, c) => `[${r+1},${c+1}]`).join('\t')
        ).join('\n');
        const newSections = sections.map((sec, si) => {
          if (si !== (editState?.sectionIdx ?? 0)) return sec;
          const insertIdx = (editState?.paraIdx ?? sec.paragraphs.length - 1) + 1;
          const newParas = [...sec.paragraphs];
          newParas.splice(insertIdx, 0, { text: tableText, fontName: 'Courier New', fontSize: 10 });
          return { ...sec, paragraphs: newParas };
        });
        onContentChange({ ...document, sections: newSections });
        return;
      }

      // ── Insert Image ──────────────────────────────────────────
      if (action.type === 'insertImage') {
        pushHistory(document);
        const newSections = sections.map((sec, si) => {
          if (si !== (editState?.sectionIdx ?? 0)) return sec;
          const insertIdx = (editState?.paraIdx ?? sec.paragraphs.length - 1) + 1;
          const newParas = [...sec.paragraphs];
          newParas.splice(insertIdx, 0, { text: `[IMAGE:${action.value.substring(0, 40)}...]`, fontName: 'monospace', fontSize: 10 });
          return { ...sec, paragraphs: newParas };
        });
        onContentChange({ ...document, sections: newSections });
        return;
      }

      // ── Page Break ───────────────────────────────────────────
      if (action.type === 'pageBreak') {
        pushHistory(document);
        const newSections = sections.map((sec, si) => {
          if (si !== (editState?.sectionIdx ?? 0)) return sec;
          const insertIdx = (editState?.paraIdx ?? sec.paragraphs.length - 1) + 1;
          const newParas = [...sec.paragraphs];
          newParas.splice(insertIdx, 0, { text: '', pageBreak: true });
          return { ...sec, paragraphs: newParas };
        });
        onContentChange({ ...document, sections: newSections });
        return;
      }

      // ── Find / Replace ───────────────────────────────────────
      if (action.type === 'find') {
        const found = sections.some((sec, si) =>
          sec.paragraphs.some((para, pi) => {
            if (para.text.includes(action.value)) {
              setEditState({ sectionIdx: si, paraIdx: pi, text: para.text });
              return true;
            }
            return false;
          })
        );
        if (!found) alert(`"${action.value}" 를 찾을 수 없습니다.`);
        return;
      }
      if (action.type === 'replace') {
        pushHistory(document);
        const newSections = sections.map((sec) => ({
          ...sec,
          paragraphs: sec.paragraphs.map((para) => ({
            ...para,
            text: para.text.replaceAll(action.find, action.replace),
          })),
        }));
        onContentChange({ ...document, sections: newSections });
        return;
      }

      // ── Clear Formatting ────────────────────────────────────
      if (action.type === 'clearFormatting') {
        updateSelectedParagraph((para) => ({
          text: para.text,
        }));
        return;
      }

      // ── Font / Size ─────────────────────────────────────────
      if (action.type === 'fontName') { setFontName(action.value); }
      if (action.type === 'fontSize') { setFontSize(action.value); }

      if (!editState) return;

      // ── Toggle formatting ───────────────────────────────────
      if (
        action.type === 'bold' || action.type === 'italic' || action.type === 'underline' ||
        action.type === 'strikethrough' || action.type === 'superscript' || action.type === 'subscript'
      ) {
        const key = action.type as keyof Paragraph;
        updateSelectedParagraph((para) => ({ ...para, [key]: !(para[key] as boolean) }));
        return;
      }

      if (action.type === 'align') {
        updateSelectedParagraph((para) => ({ ...para, align: action.value }));
        return;
      }
      if (action.type === 'textColor') {
        updateSelectedParagraph((para) => ({ ...para, textColor: action.value }));
        return;
      }
      if (action.type === 'fontName') {
        updateSelectedParagraph((para) => ({ ...para, fontName: action.value }));
        return;
      }
      if (action.type === 'fontSize') {
        updateSelectedParagraph((para) => ({ ...para, fontSize: action.value }));
        return;
      }
      if (action.type === 'highlightColor') {
        updateSelectedParagraph((para) => ({ ...para, highlightColor: action.value }));
        return;
      }
      if (action.type === 'indent') {
        updateSelectedParagraph((para) => {
          const cur = para.indent || 0;
          return { ...para, indent: action.value === 'increase' ? cur + 1 : Math.max(0, cur - 1) };
        });
        return;
      }
      if (action.type === 'list') {
        updateSelectedParagraph((para) => ({ ...para, listType: action.value }));
        return;
      }
      if (action.type === 'lineSpacing') {
        updateSelectedParagraph((para) => ({ ...para, lineSpacing: action.value }));
        return;
      }
      if (action.type === 'letterSpacing') {
        updateSelectedParagraph((para) => ({ ...para, letterSpacing: action.value }));
        return;
      }
      if (action.type === 'textScaleX') {
        updateSelectedParagraph((para) => ({ ...para, textScaleX: action.value }));
        return;
      }
      if (action.type === 'paragraphSpacingBefore') {
        updateSelectedParagraph((para) => ({ ...para, paragraphSpacingBefore: action.value }));
        return;
      }
      if (action.type === 'paragraphSpacingAfter') {
        updateSelectedParagraph((para) => ({ ...para, paragraphSpacingAfter: action.value }));
        return;
      }

      // ── Page settings ─────────────────────────────────────────
      const curPage: PageSettings = document.pageSettings ?? DEFAULT_PAGE_SETTINGS;
      if (action.type === 'setPageSize') {
        const dims = PAGE_SIZES[action.value];
        onContentChange({ ...document, pageSettings: { ...curPage, size: action.value, widthMm: dims.w, heightMm: dims.h } });
        return;
      }
      if (action.type === 'setOrientation') {
        onContentChange({ ...document, pageSettings: { ...curPage, orientation: action.value } });
        return;
      }
      if (action.type === 'setMargins') {
        onContentChange({ ...document, pageSettings: { ...curPage, margins: { ...curPage.margins, ...action.value } } });
        return;
      }
      if (action.type === 'setColumns') {
        onContentChange({ ...document, pageSettings: { ...curPage, columns: action.value } });
        return;
      }
      if (action.type === 'setHeaderText') {
        onContentChange({ ...document, pageSettings: { ...curPage, headerText: action.value } });
        return;
      }
      if (action.type === 'setFooterText') {
        onContentChange({ ...document, pageSettings: { ...curPage, footerText: action.value } });
      }
    },
  }), [editState, updateSelectedParagraph, document, sections, pushHistory, onContentChange]);

  // ── Compute page dimensions for canvas ────────────────────────────
  const pageSettings = useMemo(() => document.pageSettings ?? DEFAULT_PAGE_SETTINGS, [document.pageSettings]);
  const pageDims = useMemo(() => {
    const base = PAGE_SIZES[pageSettings.size] ?? PAGE_SIZES['A4'];
    const w = pageSettings.orientation === 'landscape' ? base.h : base.w;
    const h = pageSettings.orientation === 'landscape' ? base.w : base.h;
    // 1mm = 3.7795px at 96dpi
    const PX_PER_MM = 3.7795;
    return { widthPx: Math.round(w * PX_PER_MM), heightPx: Math.round(h * PX_PER_MM) };
  }, [pageSettings]);
  const marginPx = useMemo(() => {
    const PX_PER_MM = 3.7795;
    const m = pageSettings.margins;
    return {
      top:    Math.round(m.top    * PX_PER_MM),
      bottom: Math.round(m.bottom * PX_PER_MM),
      left:   Math.round(m.left   * PX_PER_MM),
      right:  Math.round(m.right  * PX_PER_MM),
    };
  }, [pageSettings]);

  return (
    <div className={styles.container}>
      {/* ─ Document Title ─ */}
      <div className={styles.titleSection}>
        <h1 className={styles.title}>{documentTitle}</h1>
        <p className={styles.subtitle}>
          {pageSettings.size} {pageSettings.orientation === 'landscape' ? '가로' : '세로'}
          {' · '}{document.format.toUpperCase()}
        </p>
      </div>

      {/* ─ Editor Workspace (Ruler + Canvas) ─ */}
      <div className={styles.editorWorkspace} onContextMenu={handleContextMenu}>
        {/* Top Ruler */}
        <div className={styles.topRuler}>
          {[...Array(20)].map((_, i) => (
            <div key={i} className={styles.rulerMarkTop}>
              <span className={styles.rulerText}>{i}</span>
            </div>
          ))}
        </div>

        <div className={styles.workspaceBody}>
          {/* Left Ruler */}
          <div className={styles.leftRuler}>
            {[...Array(30)].map((_, i) => (
              <div key={i} className={styles.rulerMarkLeft}>
                <span className={styles.rulerText}>{i}</span>
              </div>
            ))}
          </div>

          {/* ─ Canvas ─ */}
          <div
            className={styles.canvas}
            style={{
              width:      `${pageDims.widthPx}px`,
              minHeight:  `${pageDims.heightPx}px`,
              paddingTop:    `${marginPx.top}px`,
              paddingBottom: `${marginPx.bottom}px`,
              paddingLeft:   `${marginPx.left}px`,
              paddingRight:  `${marginPx.right}px`,
              boxSizing: 'border-box',
              columnCount: pageSettings.columns && pageSettings.columns > 1 ? pageSettings.columns : undefined,
            }}
          >
            {/* Header */}
            {pageSettings.headerText && (
              <div style={{ borderBottom: '1px solid #e2e8f0', marginBottom: '8px', paddingBottom: '4px', fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
                {pageSettings.headerText}
              </div>
            )}
            {sections.length === 0 ? (
              <div className={styles.emptyState}>
                <p>문서가 비어있습니다.</p>
              </div>
            ) : (
              sections.map((section, sectionIdx) => (
                <div key={sectionIdx} className={styles.section}>
                  {section.pageSetup && (
                    <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px dashed #e2e8f0' }}>
                      [구역 속성: {Object.entries(section.pageSetup).map(([k,v]) => `${k}=${v}`).join(', ')}]
                    </div>
                  )}
                  {section.paragraphs.map((para, paraIdx) => {
                    const isEditing =
                      editState?.sectionIdx === sectionIdx && editState?.paraIdx === paraIdx;

                    return (
                      <div
                        key={paraIdx}
                        className={`${styles.paragraph} ${isEditing ? styles.editing : ''}`}
                        style={{
                          textAlign: para.align || 'left',
                          fontFamily: para.fontName || fontName || 'Pretendard Variable, NanumGothic, sans-serif',
                          // superscript/subscript: font size shrinks to 75%
                          fontSize: para.superscript || para.subscript
                            ? `${(para.fontSize || fontSize || 14) * 0.75}pt`
                            : `${para.fontSize || fontSize || 14}pt`,
                          color: para.textColor || '#111827',
                          backgroundColor: para.highlightColor || 'transparent',
                          fontWeight: para.bold ? 'bold' : 'normal',
                          fontStyle: para.italic ? 'italic' : 'normal',
                          textDecoration: [
                            para.underline     ? 'underline'    : '',
                            para.strikethrough ? 'line-through' : '',
                          ].filter(Boolean).join(' ') || 'none',
                          verticalAlign: para.superscript ? 'super' : para.subscript ? 'sub' : 'baseline',
                          lineHeight: para.lineSpacing || 1.5,
                          letterSpacing: para.letterSpacing !== undefined ? `${para.letterSpacing}em` : undefined,
                          // 장평: CSS transform scaleX (does not affect layout width)
                          transform: para.textScaleX !== undefined && para.textScaleX !== 100
                            ? `scaleX(${para.textScaleX / 100})`
                            : undefined,
                          transformOrigin: 'left center',
                          marginLeft: `${(para.indent || 0) * 2}rem`,
                          marginTop: para.paragraphSpacingBefore ? `${para.paragraphSpacingBefore}px` : undefined,
                          marginBottom: para.paragraphSpacingAfter ? `${para.paragraphSpacingAfter}px` : undefined,
                          borderTop: para.pageBreak ? '2px dashed rgba(122,162,247,0.4)' : undefined,
                          paddingTop: para.pageBreak ? '8px' : undefined,
                          display: 'flex',
                          alignItems: 'flex-start',
                        }}
                      >
                        {para.listType === 'bullet' && <span style={{ marginRight: '8px' }}>•</span>}
                        {para.listType === 'number' && <span style={{ marginRight: '8px' }}>{paraIdx + 1}.</span>}
                        <div style={{ flex: 1 }}>
                          {isEditing ? (
                            <input
                              ref={textInputRef}
                              type="text"
                              value={editState.text}
                              onChange={handleTextChange}
                              onBlur={handleSaveText}
                              onKeyDown={handleKeyDown}
                              className={styles.input}
                              style={{
                                fontFamily: para.fontName || fontName || 'NanumGothic',
                                fontSize: `${para.fontSize || fontSize || 14}pt`,
                                color: para.textColor || '#111827',
                              }}
                            />
                          ) : (
                            <span onClick={() => handleParagraphClick(sectionIdx, paraIdx, para)}>
                              {para.text || (para.controls?.length ? '' : '(empty)')}
                            </span>
                          )}

                          {/* ─ Controls (Tables/Pictures/Embedded Paragraphs) ─ */}
                          {para.controls?.map((ctrl, ci) => (
                            <div key={ci} className={styles.controlItem}>
                              {ctrl.type === 'TABLE' && ctrl.table && (
                                <table className={styles.embeddedTable}>
                                  <tbody>
                                    {ctrl.table.rows.map((row, ri) => (
                                      <tr key={ri}>
                                        {row.cells.map((cell, cci) => (
                                          <td key={cci} colSpan={cell.colSpan} rowSpan={cell.rowSpan}>
                                            {cell.paragraphs.map((cp, cpi) => (
                                              <div key={cpi} style={{ fontSize: `${cp.fontSize || 10}pt` }}>
                                                {cp.text}
                                              </div>
                                            ))}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                              {ctrl.type === 'PICTURE' && ctrl.picture && (
                                <div className={styles.embeddedPicture}>
                                  {ctrl.picture.base64 ? (
                                    <img src={`data:image/png;base64,${ctrl.picture.base64}`} alt="embedded" />
                                  ) : (
                                    <div className={styles.imagePlaceholder}>
                                      🖼️ Image ({ctrl.picture.width} x {ctrl.picture.height})
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* Render embedded paragraphs for Header, Footer, GSO etc. */}
                              {ctrl.paragraphs && ctrl.paragraphs.length > 0 && (
                                <div style={{ border: '1px dashed #cbd5e1', padding: '8px', marginTop: '4px', backgroundColor: '#f8fafc', borderRadius: '4px' }}>
                                  <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>
                                    {ctrl.type || ctrl.gsoType || 'Embedded Object'}
                                  </div>
                                  {ctrl.paragraphs.map((cp, cpi) => (
                                    <div key={cpi} style={{ fontSize: `${cp.fontSize || 10}pt`, color: cp.textColor || '#334155' }}>
                                      {cp.text || (cp.controls?.length ? '' : '(empty)')}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─ Custom Context Menu ─ */}
      {contextMenu?.visible && (
        <div
          className={styles.contextMenu}
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button onClick={() => handleContextMenuAction('copy')}>복사 (Copy)</button>
          <button onClick={() => handleContextMenuAction('paste')}>붙여넣기 (Paste)</button>
          <hr />
          <button onClick={() => handleContextMenuAction('table_props')}>표 속성...</button>
          <button onClick={() => handleContextMenuAction('merge_cells')}>셀 병합</button>
          <button onClick={() => handleContextMenuAction('insert_row')}>줄 추가/삭제</button>
        </div>
      )}
    </div>
  );
});

export default DocumentCanvas;
