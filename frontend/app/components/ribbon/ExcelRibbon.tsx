'use client';

import React from 'react';
import styles from './OfficeRibbon.module.css';
import { SaveStatus, SpreadsheetToolAction } from '../../types/document';
import SaveStatusIndicator from './SaveStatusIndicator';
import ExportMenu, { ExportOption } from './ExportMenu';

interface ExcelRibbonProps {
  saveStatus: SaveStatus;
  lastSavedTime: string;
  onAction: (action: SpreadsheetToolAction) => void;
  onExportPdf?: () => void;
  fileName?: string;
  token?: string;
  getDocumentModel?: () => object | null;
  exportOptions?: ExportOption[];
}

const COMMON_FUNCTIONS = [
  'SUM', 'AVERAGE', 'COUNT', 'COUNTA', 'COUNTIF', 'SUMIF', 'SUMIFS',
  'MAX', 'MIN', 'MEDIAN', 'STDEV', 'VAR',
  'IF', 'IFS', 'AND', 'OR', 'NOT', 'IFERROR', 'ISBLANK',
  'XLOOKUP', 'VLOOKUP', 'HLOOKUP', 'INDEX', 'MATCH', 'OFFSET',
  'CONCAT', 'TEXTJOIN', 'LEFT', 'RIGHT', 'MID', 'LEN', 'TRIM', 'UPPER', 'LOWER',
  'TODAY', 'NOW', 'DATE', 'YEAR', 'MONTH', 'DAY', 'WEEKDAY', 'DATEDIF',
  'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'FLOOR', 'CEILING', 'ABS', 'SQRT', 'POWER', 'MOD', 'INT',
  'RANK', 'LARGE', 'SMALL', 'PERCENTRANK', 'FREQUENCY',
];

const NUMBER_FORMATS = [
  { label: '일반', value: 'General' },
  { label: '숫자', value: '0' },
  { label: '소수점 2자리', value: '0.00' },
  { label: '천단위 구분', value: '#,##0' },
  { label: '천단위 소수점', value: '#,##0.00' },
  { label: '통화 (₩)', value: '₩#,##0' },
  { label: '백분율', value: '0%' },
  { label: '백분율 소수점', value: '0.00%' },
  { label: '날짜', value: 'yyyy-mm-dd' },
  { label: '시간', value: 'hh:mm:ss' },
  { label: '지수', value: '0.00E+00' },
  { label: '텍스트', value: '@' },
];

export default function ExcelRibbon({
  saveStatus, lastSavedTime, onAction, onExportPdf,
  fileName, token, getDocumentModel, exportOptions,
}: ExcelRibbonProps) {
  return (
    <div className={styles.ribbonRoot}>
      <div className={styles.tabRow}>
        <span className={styles.brand}>Excel</span>
        <button className={`${styles.tab} ${styles.activeTab}`}>홈</button>
        <button className={styles.tab}>삽입</button>
        <button className={styles.tab}>페이지 레이아웃</button>
        <button className={styles.tab}>수식</button>
        <button className={styles.tab}>데이터</button>
        <button className={styles.tab}>검토</button>
        <button className={styles.tab}>보기</button>
        {exportOptions && fileName && getDocumentModel ? (
          <ExportMenu fileName={fileName} token={token} getDocumentModel={getDocumentModel} options={exportOptions} />
        ) : (
          onExportPdf && <button className={styles.exportPdfBtn} onClick={onExportPdf}>Print (PDF)</button>
        )}
      </div>

      <div className={styles.formulaBarWrap}>
        <span className={styles.fxLabel}>fx</span>
        <input
          className={styles.formulaInput}
          placeholder="수식 또는 값 입력..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onAction({ type: 'formula', value: (e.currentTarget.value || '').trim() });
              e.currentTarget.value = '';
            }
          }}
        />
      </div>

      <div className={styles.toolRow}>
        {/* 되돌리기 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} title="실행 취소" onClick={() => onAction({ type: 'undo' })}>↩</button>
          <button className={styles.toolBtn} title="다시 실행" onClick={() => onAction({ type: 'redo' })}>↪</button>
        </div>

        {/* 클립보드 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} title="복사" onClick={() => onAction({ type: 'copyRange' })}>📋 복사</button>
          <button className={styles.toolBtn} title="붙여넣기" onClick={() => onAction({ type: 'pasteRange' })}>📌 붙여</button>
        </div>

        {/* 자동 함수 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} title="합계" onClick={() => onAction({ type: 'autoFunction', name: 'SUM' })}>Σ 합계</button>
          <button className={styles.toolBtn} title="평균" onClick={() => onAction({ type: 'autoFunction', name: 'AVERAGE' })}>x̄ 평균</button>
          <button className={styles.toolBtn} title="개수" onClick={() => onAction({ type: 'autoFunction', name: 'COUNT' })}>N 개수</button>
          <button className={styles.toolBtn} title="최소" onClick={() => onAction({ type: 'autoFunction', name: 'MIN' })}>↓ 최소</button>
          <button className={styles.toolBtn} title="최대" onClick={() => onAction({ type: 'autoFunction', name: 'MAX' })}>↑ 최대</button>
        </div>

        {/* 함수 삽입 */}
        <div className={styles.group}>
          <select className={styles.select} defaultValue="" onChange={(e) => {
            const name = e.target.value;
            if (name) { onAction({ type: 'insertFunction', name }); e.target.value = ''; }
          }}>
            <option value="" disabled>함수 삽입</option>
            {COMMON_FUNCTIONS.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>

        {/* 서식 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} title="굵게" onClick={() => onAction({ type: 'bold' })}><b>B</b></button>
          <button className={styles.toolBtn} title="기울임" onClick={() => onAction({ type: 'italic' })}><i>I</i></button>
          <button className={styles.toolBtn} title="밑줄" onClick={() => onAction({ type: 'underline' })}>U̲</button>
          <label title="글자색" style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '11px', cursor: 'pointer' }}>
            A<input type="color" defaultValue="#1d4ed8" onChange={(e) => onAction({ type: 'textColor', value: e.target.value })} style={{ width: '20px', height: '20px', border: 'none', padding: 0 }} />
          </label>
          <label title="배경색" style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '11px', cursor: 'pointer' }}>
            🪣<input type="color" defaultValue="#fef08a" onChange={(e) => onAction({ type: 'backgroundColor', value: e.target.value })} style={{ width: '20px', height: '20px', border: 'none', padding: 0 }} />
          </label>
        </div>

        {/* 정렬 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} title="왼쪽" onClick={() => onAction({ type: 'alignCell', value: 'left' })}>≡←</button>
          <button className={styles.toolBtn} title="가운데" onClick={() => onAction({ type: 'alignCell', value: 'center' })}>≡↔</button>
          <button className={styles.toolBtn} title="오른쪽" onClick={() => onAction({ type: 'alignCell', value: 'right' })}>≡→</button>
          <button className={styles.toolBtn} title="줄 바꿈" onClick={() => onAction({ type: 'wrapText' })}>↵ 줄바꿈</button>
        </div>

        {/* 숫자 형식 */}
        <div className={styles.group}>
          <select className={styles.select} defaultValue="" onChange={(e) => {
            if (e.target.value) onAction({ type: 'numberFormat', value: e.target.value });
          }}>
            <option value="" disabled>숫자 형식</option>
            {NUMBER_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>

        {/* 셀 조작 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} title="셀 병합" onClick={() => onAction({ type: 'mergeCell' })}>⊕ 병합</button>
          <button className={styles.toolBtn} title="병합 해제" onClick={() => onAction({ type: 'unmergeCell' })}>⊘ 해제</button>
          <button className={styles.toolBtn} title="셀 지우기" onClick={() => onAction({ type: 'clearCell' })}>🗑 지우기</button>
        </div>

        {/* 행/열 조작 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} title="행 추가" onClick={() => onAction({ type: 'addRow' })}>+ 행</button>
          <button className={styles.toolBtn} title="행 삭제" onClick={() => onAction({ type: 'deleteRow' })}>− 행</button>
          <button className={styles.toolBtn} title="열 추가" onClick={() => onAction({ type: 'addCol' })}>+ 열</button>
          <button className={styles.toolBtn} title="열 삭제" onClick={() => onAction({ type: 'deleteCol' })}>− 열</button>
        </div>

        {/* 정렬 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} title="오름차순" onClick={() => onAction({ type: 'sortColumn', direction: 'asc' })}>A→Z</button>
          <button className={styles.toolBtn} title="내림차순" onClick={() => onAction({ type: 'sortColumn', direction: 'desc' })}>Z→A</button>
          <button className={styles.toolBtn} title="필터" onClick={() => onAction({ type: 'filterColumn' })}>▽ 필터</button>
        </div>

        {/* 시트 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} title="시트 추가" onClick={() => onAction({ type: 'addSheet' })}>+ 시트</button>
          <button className={styles.toolBtn} title="시트 삭제" onClick={() => onAction({ type: 'deleteSheet' })}>− 시트</button>
          <button className={styles.toolBtn} title="행 고정" onClick={() => onAction({ type: 'freezeRows', count: 1 })}>❄ 행고정</button>
          <button className={styles.toolBtn} title="열 고정" onClick={() => onAction({ type: 'freezeCols', count: 1 })}>❄ 열고정</button>
        </div>

        <SaveStatusIndicator saveStatus={saveStatus} lastSavedTime={lastSavedTime} />
      </div>
    </div>
  );
}
