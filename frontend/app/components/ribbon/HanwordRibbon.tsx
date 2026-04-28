import React from 'react';
import styles from './OfficeRibbon.module.css';
import { SaveStatus, TextToolAction } from '../../types/document';
import SaveStatusIndicator from './SaveStatusIndicator';
import ExportMenu, { ExportOption } from './ExportMenu';

interface HanwordRibbonProps {
  saveStatus: SaveStatus;
  lastSavedTime: string;
  onAction: (action: TextToolAction) => void;
  onExportPdf?: () => void;
  fileName?: string;
  token?: string;
  getDocumentModel?: () => object | null;
  exportOptions?: ExportOption[];
}

export default function HanwordRibbon({
  saveStatus, lastSavedTime, onAction, onExportPdf,
  fileName, token, getDocumentModel, exportOptions,
}: HanwordRibbonProps) {
  return (
    <div className={styles.ribbonRoot}>
      <div className={styles.tabRow}>
        <span className={styles.brand}>Hanword Ribbon</span>
        <button className={`${styles.tab} ${styles.activeTab}`}>홈</button>
        <button className={styles.tab}>쪽</button>
        <button className={styles.tab}>입력</button>
        <button className={styles.tab}>서식</button>
        <button className={styles.tab}>검토</button>
        <button className={styles.tab}>보기</button>
        {exportOptions && fileName && getDocumentModel ? (
          <ExportMenu
            fileName={fileName}
            token={token}
            getDocumentModel={getDocumentModel}
            options={exportOptions}
          />
        ) : (
          onExportPdf && <button className={styles.exportPdfBtn} onClick={onExportPdf}>인쇄(PDF)</button>
        )}
      </div>

      <div className={styles.toolRow}>
        <div className={styles.group}>
          <select className={styles.select} onChange={(e) => onAction({ type: 'fontName', value: e.target.value })}>
            <option value="NanumGothic">나눔고딕</option>
            <option value="HamchoromBatang">함초롬바탕</option>
            <option value="Malgun Gothic">맑은 고딕</option>
            <option value="Batang">바탕</option>
          </select>
          <select className={styles.select} onChange={(e) => onAction({ type: 'fontSize', value: Number(e.target.value) })}>
            {[9, 10, 11, 12, 14, 16, 18, 20, 24, 28].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>

        <div className={styles.group}>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'bold' })}>진하게</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'italic' })}>기울임</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'underline' })}>밑줄</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'textColor', value: '#b91c1c' })}>글자색</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'highlightColor', value: '#fde68a' })}>형광펜</button>
        </div>

        <div className={styles.group}>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'align', value: 'left' })}>왼쪽</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'align', value: 'center' })}>가운데</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'align', value: 'right' })}>오른쪽</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'align', value: 'justify' })}>양쪽</button>
        </div>

        <div className={styles.group}>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'list', value: 'bullet' })}>글머리표</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'list', value: 'number' })}>번호</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'indent', value: 'increase' })}>들여쓰기</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'indent', value: 'decrease' })}>내어쓰기</button>
        </div>

        <SaveStatusIndicator saveStatus={saveStatus} lastSavedTime={lastSavedTime} />
      </div>
    </div>
  );
}
