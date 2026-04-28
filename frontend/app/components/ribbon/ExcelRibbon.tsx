import React from 'react';
import styles from './OfficeRibbon.module.css';
import { SaveStatus, SpreadsheetToolAction } from '../../types/document';
import SaveStatusIndicator from './SaveStatusIndicator';

interface ExcelRibbonProps {
  saveStatus: SaveStatus;
  lastSavedTime: string;
  onAction: (action: SpreadsheetToolAction) => void;
  onExportPdf?: () => void;
}

const COMMON_FUNCTIONS = [
  'SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN',
  'IF', 'IFS', 'AND', 'OR', 'NOT',
  'XLOOKUP', 'VLOOKUP', 'HLOOKUP', 'INDEX', 'MATCH',
  'CONCAT', 'TEXTJOIN', 'LEFT', 'RIGHT', 'MID', 'LEN',
  'TODAY', 'NOW', 'DATE', 'YEAR', 'MONTH', 'DAY',
  'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'ABS', 'SQRT', 'POWER',
];

export default function ExcelRibbon({ saveStatus, lastSavedTime, onAction, onExportPdf }: ExcelRibbonProps) {
  return (
    <div className={styles.ribbonRoot}>
      <div className={styles.tabRow}>
        <span className={styles.brand}>Excel Ribbon</span>
        <button className={`${styles.tab} ${styles.activeTab}`}>Home</button>
        <button className={styles.tab}>Insert</button>
        <button className={styles.tab}>Page Layout</button>
        <button className={styles.tab}>Formulas</button>
        <button className={styles.tab}>Data</button>
        <button className={styles.tab}>Review</button>
        <button className={styles.tab}>View</button>
        {onExportPdf && <button className={styles.exportPdfBtn} onClick={onExportPdf}>Print (PDF)</button>}
      </div>

      <div className={styles.formulaBarWrap}>
        <span className={styles.fxLabel}>fx</span>
        <input
          className={styles.formulaInput}
          placeholder="Enter formula or value"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onAction({ type: 'formula', value: (e.currentTarget.value || '').trim() });
            }
          }}
        />
      </div>

      <div className={styles.toolRow}>
        <div className={styles.group}>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'autoFunction', name: 'SUM' })}>AutoSum</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'autoFunction', name: 'AVERAGE' })}>Average</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'autoFunction', name: 'COUNT' })}>Count</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'autoFunction', name: 'MIN' })}>Min</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'autoFunction', name: 'MAX' })}>Max</button>
        </div>

        <div className={styles.group}>
          <select className={styles.select} defaultValue="" onChange={(e) => {
            const name = e.target.value;
            if (name) onAction({ type: 'insertFunction', name });
          }}>
            <option value="" disabled>Insert Function</option>
            {COMMON_FUNCTIONS.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div className={styles.group}>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'mergeCell' })}>Merge</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'formatPainter' })}>Format Painter</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'sortColumn', direction: 'asc' })}>Sort A-Z</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'sortColumn', direction: 'desc' })}>Sort Z-A</button>
        </div>

        <div className={styles.group}>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'bold' })}>B</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'italic' })}>I</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'underline' })}>U</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'textColor', value: '#1d4ed8' })}>Font</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'backgroundColor', value: '#fef08a' })}>Fill</button>
        </div>

        <SaveStatusIndicator saveStatus={saveStatus} lastSavedTime={lastSavedTime} />
      </div>
    </div>
  );
}
