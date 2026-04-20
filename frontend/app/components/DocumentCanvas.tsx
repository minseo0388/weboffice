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
   * Handle text input change
   */
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setEditState((prev) => (prev ? { ...prev, text: newText } : null));
  };

  /**
   * Apply text changes: update document model and trigger save
   */
  const handleSaveText = useCallback(() => {
    if (!editState) return;

    const updatedSections = sections.map((section, sIdx) =>
      sIdx === editState.sectionIdx
        ? {
            ...section,
            paragraphs: section.paragraphs.map((para, pIdx) =>
              pIdx === editState.paraIdx
                ? { ...para, text: editState.text, fontSize, fontName }
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
    setEditState(null);
  }, [editState, fontSize, fontName, sections, document, onContentChange]);

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
                      fontWeight: para.bold ? 'bold' : 'normal',
                      fontStyle: para.italic ? 'italic' : 'normal',
                      textDecoration: para.underline ? 'underline' : 'none',
                    }}
                  >
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
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
});

export default DocumentCanvas;
