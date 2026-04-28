'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import styles from './DocumentCanvas.module.css';
import { Paragraph, TextDocumentModel, TextToolAction } from '../types/document';

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
      }
    },
  }), [editState, updateSelectedParagraph, document, sections, pushHistory, onContentChange]);

  return (
    <div className={styles.container}>
      {/* ─ Document Title ─ */}
      <div className={styles.titleSection}>
        <h1 className={styles.title}>{documentTitle}</h1>
        <p className={styles.subtitle}>{document.format.toUpperCase()} Document</p>
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
          <div className={styles.canvas}>
            {sections.length === 0 ? (
              <div className={styles.emptyState}>
                <p>문서가 비어있습니다.</p>
              </div>
            ) : (
              sections.map((section, sectionIdx) => (
                <div key={sectionIdx} className={styles.section}>
                  {section.paragraphs.map((para, paraIdx) => {
                    const isEditing =
                      editState?.sectionIdx === sectionIdx && editState?.paraIdx === paraIdx;

                    return (
                      <div
                        key={paraIdx}
                        className={`${styles.paragraph} ${isEditing ? styles.editing : ''}`}
                        style={{
                          textAlign: para.align || 'left',
                          fontFamily: para.fontName || fontName || 'NanumGothic',
                          fontSize: `${para.fontSize || fontSize || 14}pt`,
                          color: para.textColor || '#111827',
                          backgroundColor: para.highlightColor || 'transparent',
                          fontWeight: para.bold ? 'bold' : 'normal',
                          fontStyle: para.italic ? 'italic' : 'normal',
                          textDecoration: [
                            para.underline    ? 'underline'    : '',
                            para.strikethrough ? 'line-through' : '',
                          ].filter(Boolean).join(' ') || 'none',
                          verticalAlign: para.superscript ? 'super' : para.subscript ? 'sub' : 'baseline',
                          fontSize: para.superscript || para.subscript ? `${(para.fontSize || fontSize || 14) * 0.75}pt` : `${para.fontSize || fontSize || 14}pt`,
                          lineHeight: para.lineSpacing || 1.5,
                          marginLeft: `${(para.indent || 0) * 2}rem`,
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
                            {para.text || '(empty)'}
                          </span>
                        )}
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
