'use client';

import React from 'react';
import styles from './RibbonManager.module.css';
import {
  FileType,
  PresentationToolAction,
  SaveStatus,
  SpreadsheetToolAction,
  TextToolAction,
} from '../types/document';

interface RibbonManagerProps {
  fileType: FileType;
  saveStatus: SaveStatus;
  lastSavedTime: string;
  onTextAction: (action: TextToolAction) => void;
  onSpreadsheetAction: (action: SpreadsheetToolAction) => void;
  onPresentationAction: (action: PresentationToolAction) => void;
  onExportPdf?: () => void;
}

function SaveIndicator({ saveStatus, lastSavedTime }: Pick<RibbonManagerProps, 'saveStatus' | 'lastSavedTime'>) {
  return (
    <div className={styles.saveArea}>
      <span className={`${styles.saveBadge} ${styles[saveStatus]}`}>
        {saveStatus === 'idle' && 'Ready'}
        {saveStatus === 'saving' && 'Saving...'}
        {saveStatus === 'saved' && 'Saved'}
        {saveStatus === 'error' && 'Error'}
      </span>
      {lastSavedTime && <span className={styles.lastSaved}>Last: {lastSavedTime}</span>}
    </div>
  );
}

export default function RibbonManager({
  fileType,
  saveStatus,
  lastSavedTime,
  onTextAction,
  onSpreadsheetAction,
  onPresentationAction,
  onExportPdf,
}: RibbonManagerProps) {
  const normalized = String(fileType || 'unknown').toLowerCase() as FileType;
  const isExcel = normalized === 'xlsx' || normalized === 'xls';
  const isPpt = normalized === 'pptx';

  return (
    <div className={styles.ribbonRoot}>
      <div className={styles.tabRow}>
        <div style={{ display: 'flex' }}>
          <button className={`${styles.tab} ${styles.activeTab}`}>Home</button>
          <button className={styles.tab}>Insert</button>
          <button className={styles.tab}>Layout</button>
          {isExcel && <button className={styles.tab}>Formulas</button>}
          {isPpt && <button className={styles.tab}>Slide</button>}
        </div>
        {onExportPdf && (
          <button className={styles.exportPdfBtn} onClick={onExportPdf} style={{
            marginLeft: 'auto',
            marginRight: '1rem',
            padding: '4px 12px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold'
          }}>
            🖨 Print (PDF)
          </button>
        )}
      </div>

      {isExcel ? (
        <>
          <div className={styles.formulaBarWrap}>
            <span className={styles.fxLabel}>fx</span>
            <input className={styles.formulaInput} placeholder="Enter formula or value" onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSpreadsheetAction({ type: 'formula', value: (e.currentTarget.value || '').trim() });
              }
            }} />
          </div>
          <div className={styles.toolRow}>
            <div className={styles.group}>
              <button className={styles.toolBtn} onClick={() => onSpreadsheetAction({ type: 'mergeCell' })}>Merge</button>
              <button className={styles.toolBtn} onClick={() => onSpreadsheetAction({ type: 'formatPainter' })}>Format Painter</button>
            </div>
            <div className={styles.group}>
              <button className={styles.toolBtn} onClick={() => onSpreadsheetAction({ type: 'bold' })}>B</button>
              <button className={styles.toolBtn} onClick={() => onSpreadsheetAction({ type: 'underline' })}>U</button>
              <button className={styles.toolBtn} onClick={() => onSpreadsheetAction({ type: 'textColor', value: '#1d4ed8' })}>Color</button>
            </div>
            <div className={styles.group}>
              <button className={styles.toolBtn} onClick={() => onSpreadsheetAction({ type: 'sortColumn', direction: 'asc' })}>Sort A-Z</button>
              <button className={styles.toolBtn} onClick={() => onSpreadsheetAction({ type: 'sortColumn', direction: 'desc' })}>Sort Z-A</button>
            </div>
            <SaveIndicator saveStatus={saveStatus} lastSavedTime={lastSavedTime} />
          </div>
        </>
      ) : isPpt ? (
        <div className={styles.toolRow}>
          <div className={styles.group}>
            <button className={styles.toolBtn} onClick={() => onPresentationAction({ type: 'addSlide' })}>+ Slide</button>
            <button className={styles.toolBtn} onClick={() => onPresentationAction({ type: 'deleteSlide' })}>- Slide</button>
          </div>
          <div className={styles.group}>
            <button className={styles.toolBtn} onClick={() => onPresentationAction({ type: 'addShape' })}>TextBox</button>
            <button className={styles.toolBtn} onClick={() => onPresentationAction({ type: 'addRect' })}>Rect</button>
            <button className={styles.toolBtn} onClick={() => onPresentationAction({ type: 'addEllipse' })}>Circle</button>
            <button className={styles.toolBtn} onClick={() => onPresentationAction({ type: 'addTriangle' })}>Triangle</button>
            <button className={styles.toolBtn} onClick={() => onPresentationAction({ type: 'addRightArrow' })}>Arrow</button>
            <button className={styles.toolBtn} onClick={() => onPresentationAction({ type: 'addStar' })}>Star</button>
            <button className={styles.toolBtn} onClick={() => {
              const url = window.prompt("Enter image URL:", "https://via.placeholder.com/300");
              if (url) onPresentationAction({ type: 'addImage', value: url });
            }}>+ Image</button>
            <button className={styles.toolBtn} onClick={() => onPresentationAction({ type: 'deleteShape' })}>- Delete</button>
          </div>
          <div className={styles.group}>
            <button className={styles.toolBtn} onClick={() => onPresentationAction({ type: 'bold' })}>B</button>
            <button className={styles.toolBtn} onClick={() => onPresentationAction({ type: 'italic' })}>I</button>
            <button className={styles.toolBtn} onClick={() => onPresentationAction({ type: 'underline' })}>U</button>
            <button className={styles.toolBtn} onClick={() => onPresentationAction({ type: 'textColor', value: '#be123c' })}>Color</button>
            <button className={styles.toolBtn} onClick={() => onPresentationAction({ type: 'fontSize', value: 18 })}>18pt</button>
            <button className={styles.toolBtn} onClick={() => onPresentationAction({ type: 'fontSize', value: 28 })}>28pt</button>
          </div>
          <div className={styles.group}>
            <button className={styles.toolBtn} onClick={() => onPresentationAction({ type: 'align', value: 'left' })}>Left</button>
            <button className={styles.toolBtn} onClick={() => onPresentationAction({ type: 'align', value: 'center' })}>Center</button>
            <button className={styles.toolBtn} onClick={() => onPresentationAction({ type: 'bullet' })}>• List</button>
          </div>
          <div className={styles.group}>
            <button className={styles.toolBtn} onClick={() => onPresentationAction({ type: 'aiTranslate' })} style={{ background: '#8b5cf6', color: 'white', fontWeight: 'bold' }}>✨ AI Translate</button>
            <button className={styles.toolBtn} onClick={() => onPresentationAction({ type: 'togglePresentMode' })} style={{ background: '#2563eb', color: 'white', fontWeight: 'bold' }}>▶ Present</button>
          </div>
          <SaveIndicator saveStatus={saveStatus} lastSavedTime={lastSavedTime} />
        </div>
      ) : (
        <div className={styles.toolRow}>
          <div className={styles.group}>
            <select className={styles.select} onChange={(e) => onTextAction({ type: 'fontName', value: e.target.value })}>
              <option value="NanumGothic">NanumGothic</option>
              <option value="HamchoromBatang">HamchoromBatang</option>
              <option value="Calibri">Calibri</option>
              <option value="Arial">Arial</option>
            </select>
            <select className={styles.select} onChange={(e) => onTextAction({ type: 'fontSize', value: Number(e.target.value) })}>
              {[10, 11, 12, 14, 16, 18, 20, 24, 28].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          <div className={styles.group}>
            <button className={styles.toolBtn} onClick={() => onTextAction({ type: 'bold' })}>B</button>
            <button className={styles.toolBtn} onClick={() => onTextAction({ type: 'italic' })}>I</button>
            <button className={styles.toolBtn} onClick={() => onTextAction({ type: 'underline' })}>U</button>
            <button className={styles.toolBtn} onClick={() => onTextAction({ type: 'textColor', value: '#b91c1c' })}>Color</button>
            <button className={styles.toolBtn} onClick={() => onTextAction({ type: 'highlightColor', value: '#fef08a' })}>Highlight</button>
          </div>
          <div className={styles.group}>
            <button className={styles.toolBtn} onClick={() => onTextAction({ type: 'align', value: 'left' })}>Left</button>
            <button className={styles.toolBtn} onClick={() => onTextAction({ type: 'align', value: 'center' })}>Center</button>
            <button className={styles.toolBtn} onClick={() => onTextAction({ type: 'align', value: 'right' })}>Right</button>
            <button className={styles.toolBtn} onClick={() => onTextAction({ type: 'align', value: 'justify' })}>Justify</button>
          </div>
          <div className={styles.group}>
            <button className={styles.toolBtn} onClick={() => onTextAction({ type: 'list', value: 'bullet' })}>• Bullet</button>
            <button className={styles.toolBtn} onClick={() => onTextAction({ type: 'list', value: 'number' })}>1. Number</button>
            <button className={styles.toolBtn} onClick={() => onTextAction({ type: 'indent', value: 'increase' })}>→ Indent</button>
            <button className={styles.toolBtn} onClick={() => onTextAction({ type: 'indent', value: 'decrease' })}>← Outdent</button>
          </div>
          <div className={styles.group}>
            <select className={styles.select} onChange={(e) => onTextAction({ type: 'lineSpacing', value: Number(e.target.value) })}>
              <option value="1.0">1.0 Spacing</option>
              <option value="1.15">1.15 Spacing</option>
              <option value="1.5">1.5 Spacing</option>
              <option value="2.0">2.0 Spacing</option>
            </select>
          </div>
          <div className={styles.group}>
            <button className={styles.toolBtn}>Table</button>
          </div>
          <SaveIndicator saveStatus={saveStatus} lastSavedTime={lastSavedTime} />
        </div>
      )}
    </div>
  );
}
