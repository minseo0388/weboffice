import React from 'react';
import styles from './OfficeRibbon.module.css';
import { SaveStatus, TextToolAction } from '../../types/document';
import SaveStatusIndicator from './SaveStatusIndicator';
import ExportMenu, { ExportOption } from './ExportMenu';

interface WordRibbonProps {
  saveStatus: SaveStatus;
  lastSavedTime: string;
  onAction: (action: TextToolAction) => void;
  onExportPdf?: () => void;
  // ExportMenu props
  fileName?: string;
  token?: string;
  getDocumentModel?: () => object | null;
  exportOptions?: ExportOption[];
}

export default function WordRibbon({
  saveStatus, lastSavedTime, onAction, onExportPdf,
  fileName, token, getDocumentModel, exportOptions,
}: WordRibbonProps) {
  return (
    <div className={styles.ribbonRoot}>
      <div className={styles.tabRow}>
        <span className={styles.brand}>Word Ribbon</span>
        <button className={`${styles.tab} ${styles.activeTab}`}>Home</button>
        <button className={styles.tab}>Insert</button>
        <button className={styles.tab}>Design</button>
        <button className={styles.tab}>Layout</button>
        <button className={styles.tab}>References</button>
        <button className={styles.tab}>Review</button>
        <button className={styles.tab}>View</button>
        {exportOptions && fileName && getDocumentModel ? (
          <ExportMenu
            fileName={fileName}
            token={token}
            getDocumentModel={getDocumentModel}
            options={exportOptions}
          />
        ) : (
          onExportPdf && <button className={styles.exportPdfBtn} onClick={onExportPdf}>Print (PDF)</button>
        )}
      </div>

      <div className={styles.toolRow}>
        <div className={styles.group}>
          <select className={styles.select} onChange={(e) => onAction({ type: 'fontName', value: e.target.value })}>
            <option value="Calibri">Calibri</option>
            <option value="Arial">Arial</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="NanumGothic">NanumGothic</option>
          </select>
          <select className={styles.select} onChange={(e) => onAction({ type: 'fontSize', value: Number(e.target.value) })}>
            {[10, 11, 12, 14, 16, 18, 20, 24, 28].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>

        <div className={styles.group}>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'bold' })}>B</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'italic' })}>I</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'underline' })}>U</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'textColor', value: '#b91c1c' })}>Color</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'highlightColor', value: '#fef08a' })}>Highlight</button>
        </div>

        <div className={styles.group}>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'align', value: 'left' })}>Left</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'align', value: 'center' })}>Center</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'align', value: 'right' })}>Right</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'align', value: 'justify' })}>Justify</button>
        </div>

        <div className={styles.group}>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'list', value: 'bullet' })}>• Bullet</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'list', value: 'number' })}>1. Number</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'indent', value: 'increase' })}>Indent</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'indent', value: 'decrease' })}>Outdent</button>
        </div>

        <div className={styles.group}>
          <select className={styles.select} onChange={(e) => onAction({ type: 'lineSpacing', value: Number(e.target.value) })}>
            <option value="1.0">1.0</option>
            <option value="1.15">1.15</option>
            <option value="1.5">1.5</option>
            <option value="2.0">2.0</option>
          </select>
        </div>

        <SaveStatusIndicator saveStatus={saveStatus} lastSavedTime={lastSavedTime} />
      </div>
    </div>
  );
}
