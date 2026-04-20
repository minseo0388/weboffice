'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import styles from './DocumentCanvas.module.css';

interface Paragraph {
  text: string;
  fontName?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: 'left' | 'center' | 'right' | 'justify';
}

interface Section {
  paragraphs: Paragraph[];
}

interface DocumentModel {
  title: string;
  format: string;
  sections: Section[];
  fontMap?: Record<string, string>;
}

interface DocumentCanvasProps {
  document: DocumentModel;
  onContentChange: (updatedModel: DocumentModel) => void;
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
export default function DocumentCanvas({ document, onContentChange }: DocumentCanvasProps) {
  const [editState, setEditState] = useState<EditState | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<'bold' | 'italic' | 'underline' | null>(null);
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
      setSelectedFormat(null);

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

    const updatedModel: DocumentModel = {
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

  /**
   * Toggle formatting (bold, italic, underline)
   */
  const toggleFormatting = (format: 'bold' | 'italic' | 'underline') => {
    if (!editState) return;

    const updatedSections = sections.map((section, sIdx) =>
      sIdx === editState.sectionIdx
        ? {
            ...section,
            paragraphs: section.paragraphs.map((para, pIdx) =>
              pIdx === editState.paraIdx
                ? {
                    ...para,
                    [format]: !(para[format as keyof Paragraph] as boolean),
                  }
                : para
            ),
          }
        : section
    );

    const updatedModel: DocumentModel = {
      ...document,
      sections: updatedSections,
    };

    onContentChange(updatedModel);
  };

  return (
    <div className={styles.container}>
      {/* ─ Toolbar ─ */}
      <div className={styles.toolbar}>
        <div className={styles.toolGroup}>
          <select
            value={fontName}
            onChange={(e) => setFontName(e.target.value)}
            className={styles.fontSelect}
          >
            <option value="NanumGothic">NanumGothic</option>
            <option value="HamchoromBatang">HamchoromBatang</option>
            <option value="Calibri">Calibri</option>
            <option value="Arial">Arial</option>
            <option value="Times New Roman">Times New Roman</option>
          </select>

          <select
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className={styles.sizeSelect}
          >
            {[8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.toolGroup}>
          <button
            className={`${styles.toolBtn} ${selectedFormat === 'bold' ? styles.active : ''}`}
            onClick={() => toggleFormatting('bold')}
            title="Bold (Ctrl+B)"
          >
            <strong>B</strong>
          </button>
          <button
            className={`${styles.toolBtn} ${selectedFormat === 'italic' ? styles.active : ''}`}
            onClick={() => toggleFormatting('italic')}
            title="Italic (Ctrl+I)"
          >
            <em>I</em>
          </button>
          <button
            className={`${styles.toolBtn} ${selectedFormat === 'underline' ? styles.active : ''}`}
            onClick={() => toggleFormatting('underline')}
            title="Underline (Ctrl+U)"
          >
            <u>U</u>
          </button>
        </div>

        <div className={styles.toolGroup}>
          <button className={styles.actionBtn} onClick={handleSaveText} disabled={!editState}>
            💾 Save Changes
          </button>
        </div>
      </div>

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
                      fontFamily: para.fontName || 'NanumGothic',
                      fontSize: `${para.fontSize || 14}pt`,
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
                          fontFamily: para.fontName || 'NanumGothic',
                          fontSize: `${para.fontSize || 14}pt`,
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
}
