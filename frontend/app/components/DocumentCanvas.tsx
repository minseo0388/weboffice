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
  
  // ── Cursor Persistence (Phase 4 Audit) ──
  const selectionRef = useRef<{ start: number | null; end: number | null }>({ start: null, end: null });

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
      onContentChange({ ...document, sections: updatedSections });
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
      if (action.type === 'fontName') {
        setFontName(action.value);
      }

      if (action.type === 'fontSize') {
        setFontSize(action.value);
      }

      if (!editState) {
        return;
      }

      if (action.type === 'bold' || action.type === 'italic' || action.type === 'underline') {
        const key = action.type;
        updateSelectedParagraph((para) => ({
          ...para,
          [key]: !(para[key as keyof Paragraph] as boolean),
        }));
        return;
      }

      if (action.type === 'align') {
        updateSelectedParagraph((para) => ({
          ...para,
          align: action.value,
        }));
        return;
      }

      if (action.type === 'textColor') {
        updateSelectedParagraph((para) => ({
          ...para,
          textColor: action.value,
        }));
        return;
      }

      if (action.type === 'fontName') {
        updateSelectedParagraph((para) => ({
          ...para,
          fontName: action.value,
        }));
        return;
      }

      if (action.type === 'fontSize') {
        updateSelectedParagraph((para) => ({
          ...para,
          fontSize: action.value,
        }));
        return;
      }

      if (action.type === 'highlightColor') {
        updateSelectedParagraph((para) => ({
          ...para,
          highlightColor: action.value,
        }));
        return;
      }

      if (action.type === 'indent') {
        updateSelectedParagraph((para) => {
          const currentIndent = para.indent || 0;
          return {
            ...para,
            indent: action.value === 'increase' ? currentIndent + 1 : Math.max(0, currentIndent - 1),
          };
        });
        return;
      }

      if (action.type === 'list') {
        updateSelectedParagraph((para) => ({
          ...para,
          listType: action.value,
        }));
        return;
      }

      if (action.type === 'lineSpacing') {
        updateSelectedParagraph((para) => ({
          ...para,
          lineSpacing: action.value,
        }));
      }
    },
  }), [editState, updateSelectedParagraph]);

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
                          textDecoration: para.underline ? 'underline' : 'none',
                          lineHeight: para.lineSpacing || 1.5,
                          marginLeft: `${(para.indent || 0) * 2}rem`,
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
