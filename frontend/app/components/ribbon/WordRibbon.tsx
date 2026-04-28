'use client';

import React, { useRef, useState } from 'react';
import styles from './OfficeRibbon.module.css';
import { SaveStatus, TextToolAction } from '../../types/document';
import SaveStatusIndicator from './SaveStatusIndicator';
import ExportMenu, { ExportOption } from './ExportMenu';

interface WordRibbonProps {
  saveStatus: SaveStatus;
  lastSavedTime: string;
  onAction: (action: TextToolAction) => void;
  onExportPdf?: () => void;
  fileName?: string;
  token?: string;
  getDocumentModel?: () => object | null;
  exportOptions?: ExportOption[];
}

const FONTS = ['Calibri', 'Arial', 'Times New Roman', 'NanumGothic', 'Malgun Gothic', 'Batang', 'Courier New'];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];
const LINE_SPACINGS = [{ label: '1.0', value: 1.0 }, { label: '1.15', value: 1.15 }, { label: '1.5', value: 1.5 }, { label: '2.0', value: 2.0 }, { label: '2.5', value: 2.5 }];

export default function WordRibbon({
  saveStatus, lastSavedTime, onAction, onExportPdf,
  fileName, token, getDocumentModel, exportOptions,
}: WordRibbonProps) {
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
        <span className={styles.brand}>Word</span>
        <button className={`${styles.tab} ${styles.activeTab}`}>홈</button>
        <button className={styles.tab}>삽입</button>
        <button className={styles.tab}>디자인</button>
        <button className={styles.tab}>레이아웃</button>
        <button className={styles.tab}>참조</button>
        <button className={styles.tab}>검토</button>
        <button className={styles.tab}>보기</button>
        {exportOptions && fileName && getDocumentModel ? (
          <ExportMenu fileName={fileName} token={token} getDocumentModel={getDocumentModel} options={exportOptions} />
        ) : (
          onExportPdf && <button className={styles.exportPdfBtn} onClick={onExportPdf}>PDF</button>
        )}
      </div>

      <div className={styles.toolRow}>
        {/* 되돌리기 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'undo' })} title="실행취소 (Ctrl+Z)">↩</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'redo' })} title="다시실행 (Ctrl+Y)">↪</button>
        </div>

        {/* 폰트 */}
        <div className={styles.group}>
          <select className={styles.select} onChange={(e) => onAction({ type: 'fontName', value: e.target.value })}>
            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select className={styles.select} style={{ width: '52px' }} onChange={(e) => onAction({ type: 'fontSize', value: Number(e.target.value) })}>
            {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* 서식 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} title="굵게" onClick={() => onAction({ type: 'bold' })}><b>B</b></button>
          <button className={styles.toolBtn} title="기울임" onClick={() => onAction({ type: 'italic' })}><i>I</i></button>
          <button className={styles.toolBtn} title="밑줄" onClick={() => onAction({ type: 'underline' })}>U̲</button>
          <button className={styles.toolBtn} title="취소선" onClick={() => onAction({ type: 'strikethrough' })}><s>S</s></button>
          <button className={styles.toolBtn} title="위첨자" onClick={() => onAction({ type: 'superscript' })}>x²</button>
          <button className={styles.toolBtn} title="아래첨자" onClick={() => onAction({ type: 'subscript' })}>x₂</button>
        </div>

        {/* 색상 */}
        <div className={styles.group}>
          <label title="글자색" style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', cursor: 'pointer' }}>
            A<input type="color" defaultValue="#b91c1c" onChange={(e) => onAction({ type: 'textColor', value: e.target.value })} style={{ width: '22px', height: '22px', border: 'none', padding: 0, cursor: 'pointer' }} />
          </label>
          <label title="형광펜" style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', cursor: 'pointer' }}>
            🖌<input type="color" defaultValue="#fef08a" onChange={(e) => onAction({ type: 'highlightColor', value: e.target.value })} style={{ width: '22px', height: '22px', border: 'none', padding: 0, cursor: 'pointer' }} />
          </label>
        </div>

        {/* 정렬 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} title="왼쪽" onClick={() => onAction({ type: 'align', value: 'left' })}>≡←</button>
          <button className={styles.toolBtn} title="가운데" onClick={() => onAction({ type: 'align', value: 'center' })}>≡↔</button>
          <button className={styles.toolBtn} title="오른쪽" onClick={() => onAction({ type: 'align', value: 'right' })}>≡→</button>
          <button className={styles.toolBtn} title="양쪽" onClick={() => onAction({ type: 'align', value: 'justify' })}>≡</button>
        </div>

        {/* 목록/들여쓰기 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} title="글머리표" onClick={() => onAction({ type: 'list', value: 'bullet' })}>• 목록</button>
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
          <button className={styles.toolBtn} title="단락 추가" onClick={() => onAction({ type: 'addParagraph' })}>+ 단락</button>
          <button className={styles.toolBtn} title="단락 삭제" onClick={() => onAction({ type: 'deleteParagraph' })}>− 단락</button>
          <button className={styles.toolBtn} title="페이지 나누기" onClick={() => onAction({ type: 'pageBreak' })}>⊞ 페이지</button>
        </div>

        {/* 삽입 */}
        <div className={styles.group}>
          {/* 표 삽입 피커 */}
          <div style={{ position: 'relative' }}>
            <button className={styles.toolBtn} title="표 삽입" onClick={() => setShowTablePicker(v => !v)}>⊞ 표</button>
            {showTablePicker && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 999,
                background: '#1e1f2e', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px', padding: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                <div style={{ fontSize: '11px', color: '#7aa2f7', marginBottom: '6px' }}>
                  {tableHover.rows > 0 ? `${tableHover.rows} × ${tableHover.cols} 표` : '표 크기 선택'}
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
          <button className={styles.toolBtn} title="이미지 삽입" onClick={handleInsertImage}>🖼 이미지</button>
        </div>

        {/* 검색/바꾸기 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} title="찾기/바꾸기" onClick={() => setShowFind(v => !v)}>🔍 찾기</button>
          <button className={styles.toolBtn} title="서식 지우기" onClick={() => onAction({ type: 'clearFormatting' })}>🚫 서식</button>
        </div>

        <SaveStatusIndicator saveStatus={saveStatus} lastSavedTime={lastSavedTime} />
      </div>

      {/* 검색/바꾸기 패널 */}
      {showFind && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px',
          background: 'rgba(122,162,247,0.06)', borderTop: '1px solid rgba(255,255,255,0.06)',
          fontSize: '12px',
        }}>
          <span style={{ color: '#7aa2f7' }}>찾기:</span>
          <input value={findText} onChange={e => setFindText(e.target.value)} placeholder="찾을 텍스트"
            style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '12px', width: '140px' }} />
          <span style={{ color: '#7aa2f7' }}>바꾸기:</span>
          <input value={replaceText} onChange={e => setReplaceText(e.target.value)} placeholder="바꿀 텍스트"
            style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '12px', width: '140px' }} />
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'find', value: findText })}>찾기</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'replace', find: findText, replace: replaceText })}>모두 바꾸기</button>
          <button className={styles.toolBtn} onClick={() => setShowFind(false)} style={{ marginLeft: 'auto' }}>✕</button>
        </div>
      )}
    </div>
  );
}
