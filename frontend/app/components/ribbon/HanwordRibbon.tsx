'use client';

import React, { useRef, useState } from 'react';
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

const HAN_FONTS = ['나눔고딕', '함초롬바탕', '맑은 고딕', '바탕', '굴림', '돋움', '궁서', 'HY신명조', 'HY헤드라인M'];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];
const LINE_SPACINGS = [
  { label: '160%', value: 1.6 }, { label: '180%', value: 1.8 },
  { label: '200%', value: 2.0 }, { label: '130%', value: 1.3 },
  { label: '100%', value: 1.0 },
];

export default function HanwordRibbon({
  saveStatus, lastSavedTime, onAction, onExportPdf,
  fileName, token, getDocumentModel, exportOptions,
}: HanwordRibbonProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [showFind, setShowFind] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tableHover, setTableHover] = useState({ rows: 0, cols: 0 });

  const handleInsertImage = () => imageInputRef.current?.click();
  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onAction({ type: 'insertImage', value: reader.result });
    };
    reader.readAsDataURL(file);
    e.currentTarget.value = '';
  };

  return (
    <div className={styles.ribbonRoot}>
      <div className={styles.tabRow}>
        <span className={styles.brand}>한/글</span>
        <button className={`${styles.tab} ${styles.activeTab}`}>홈</button>
        <button className={styles.tab}>쪽</button>
        <button className={styles.tab}>입력</button>
        <button className={styles.tab}>서식</button>
        <button className={styles.tab}>표</button>
        <button className={styles.tab}>검토</button>
        <button className={styles.tab}>보기</button>
        {exportOptions && fileName && getDocumentModel ? (
          <ExportMenu fileName={fileName} token={token} getDocumentModel={getDocumentModel} options={exportOptions} />
        ) : (
          onExportPdf && <button className={styles.exportPdfBtn} onClick={onExportPdf}>인쇄(PDF)</button>
        )}
      </div>

      <div className={styles.toolRow}>
        {/* 되돌리기 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} title="실행 취소 (Ctrl+Z)" onClick={() => onAction({ type: 'undo' })}>↩</button>
          <button className={styles.toolBtn} title="다시 실행 (Ctrl+Y)" onClick={() => onAction({ type: 'redo' })}>↪</button>
        </div>

        {/* 글꼴 */}
        <div className={styles.group}>
          <select className={styles.select} onChange={(e) => onAction({ type: 'fontName', value: e.target.value })}>
            {HAN_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select className={styles.select} style={{ width: '52px' }} onChange={(e) => onAction({ type: 'fontSize', value: Number(e.target.value) })}>
            {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* 글자 속성 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} title="진하게" onClick={() => onAction({ type: 'bold' })}><b>가</b></button>
          <button className={styles.toolBtn} title="기울임" onClick={() => onAction({ type: 'italic' })}><i>가</i></button>
          <button className={styles.toolBtn} title="밑줄" onClick={() => onAction({ type: 'underline' })}>가̲</button>
          <button className={styles.toolBtn} title="취소선" onClick={() => onAction({ type: 'strikethrough' })}><s>가</s></button>
          <button className={styles.toolBtn} title="위첨자" onClick={() => onAction({ type: 'superscript' })}>위²</button>
          <button className={styles.toolBtn} title="아래첨자" onClick={() => onAction({ type: 'subscript' })}>아₂</button>
        </div>

        {/* 색상 */}
        <div className={styles.group}>
          <label title="글자색" style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', cursor: 'pointer' }}>
            글<input type="color" defaultValue="#b91c1c" onChange={(e) => onAction({ type: 'textColor', value: e.target.value })} style={{ width: '22px', height: '22px', border: 'none', padding: 0 }} />
          </label>
          <label title="형광펜" style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', cursor: 'pointer' }}>
            펜<input type="color" defaultValue="#fde68a" onChange={(e) => onAction({ type: 'highlightColor', value: e.target.value })} style={{ width: '22px', height: '22px', border: 'none', padding: 0 }} />
          </label>
        </div>

        {/* 정렬 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} title="왼쪽 정렬" onClick={() => onAction({ type: 'align', value: 'left' })}>≡←</button>
          <button className={styles.toolBtn} title="가운데 정렬" onClick={() => onAction({ type: 'align', value: 'center' })}>≡↔</button>
          <button className={styles.toolBtn} title="오른쪽 정렬" onClick={() => onAction({ type: 'align', value: 'right' })}>≡→</button>
          <button className={styles.toolBtn} title="양쪽 정렬" onClick={() => onAction({ type: 'align', value: 'justify' })}>≡</button>
        </div>

        {/* 문단/목록 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} title="글머리표" onClick={() => onAction({ type: 'list', value: 'bullet' })}>• 글머리</button>
          <button className={styles.toolBtn} title="번호 목록" onClick={() => onAction({ type: 'list', value: 'number' })}>1. 번호</button>
          <button className={styles.toolBtn} title="들여쓰기" onClick={() => onAction({ type: 'indent', value: 'increase' })}>→|</button>
          <button className={styles.toolBtn} title="내어쓰기" onClick={() => onAction({ type: 'indent', value: 'decrease' })}>|←</button>
        </div>

        {/* 줄 간격 */}
        <div className={styles.group}>
          <select className={styles.select} title="줄 간격" onChange={(e) => onAction({ type: 'lineSpacing', value: Number(e.target.value) })}>
            {LINE_SPACINGS.map(ls => <option key={ls.value} value={ls.value}>{ls.label}</option>)}
          </select>
        </div>

        {/* 단락 추가/삭제 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} title="문단 추가" onClick={() => onAction({ type: 'addParagraph' })}>+ 문단</button>
          <button className={styles.toolBtn} title="문단 삭제" onClick={() => onAction({ type: 'deleteParagraph' })}>− 문단</button>
          <button className={styles.toolBtn} title="쪽 나누기" onClick={() => onAction({ type: 'pageBreak' })}>⊞ 쪽</button>
        </div>

        {/* 삽입 */}
        <div className={styles.group}>
          <div style={{ position: 'relative' }}>
            <button className={styles.toolBtn} title="표 넣기" onClick={() => setShowTablePicker(v => !v)}>⊞ 표</button>
            {showTablePicker && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 999,
                background: '#1e1f2e', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px', padding: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                <div style={{ fontSize: '11px', color: '#7aa2f7', marginBottom: '6px' }}>
                  {tableHover.rows > 0 ? `${tableHover.rows}행 × ${tableHover.cols}열 표` : '표 크기 선택'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,18px)', gap: '2px' }}>
                  {Array.from({ length: 64 }).map((_, i) => {
                    const r = Math.floor(i / 8) + 1;
                    const c = (i % 8) + 1;
                    const active = r <= tableHover.rows && c <= tableHover.cols;
                    return (
                      <div key={i}
                        style={{ width: 16, height: 16, border: '1px solid', borderColor: active ? '#7aa2f7' : '#3a3b4e', background: active ? 'rgba(122,162,247,0.2)' : 'transparent', borderRadius: '2px', cursor: 'pointer' }}
                        onMouseEnter={() => setTableHover({ rows: r, cols: c })}
                        onClick={() => { onAction({ type: 'insertTable', rows: r, cols: c }); setShowTablePicker(false); }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} />
          <button className={styles.toolBtn} title="그림 넣기" onClick={handleInsertImage}>🖼 그림</button>
        </div>

        {/* 찾기/바꾸기 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} title="찾아 바꾸기 (Ctrl+H)" onClick={() => setShowFind(v => !v)}>🔍 찾기</button>
          <button className={styles.toolBtn} title="서식 초기화" onClick={() => onAction({ type: 'clearFormatting' })}>🚫 서식</button>
        </div>

        <SaveStatusIndicator saveStatus={saveStatus} lastSavedTime={lastSavedTime} />
      </div>

      {showFind && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px',
          background: 'rgba(122,162,247,0.06)', borderTop: '1px solid rgba(255,255,255,0.06)',
          fontSize: '12px',
        }}>
          <span style={{ color: '#7aa2f7' }}>찾기:</span>
          <input value={findText} onChange={e => setFindText(e.target.value)} placeholder="찾을 내용"
            style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '12px', width: '140px' }} />
          <span style={{ color: '#7aa2f7' }}>바꿀 내용:</span>
          <input value={replaceText} onChange={e => setReplaceText(e.target.value)} placeholder="바꿀 내용"
            style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '12px', width: '140px' }} />
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'find', value: findText })}>찾기</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'replace', find: findText, replace: replaceText })}>모두 바꾸기</button>
          <button className={styles.toolBtn} onClick={() => setShowFind(false)} style={{ marginLeft: 'auto' }}>✕</button>
        </div>
      )}
    </div>
  );
}
