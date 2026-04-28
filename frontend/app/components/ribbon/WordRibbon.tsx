'use client';

import React, { useRef, useState } from 'react';
import styles from './OfficeRibbon.module.css';
import { SaveStatus, TextToolAction, PageSizeName, PageOrientation } from '../../types/document';
import SaveStatusIndicator from './SaveStatusIndicator';
import ExportMenu, { ExportOption } from './ExportMenu';
import FontPicker from './FontPicker';
import FontSizePicker from './FontSizePicker';

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

const SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 48, 72];
const LINE_SPACINGS = [
  { label: '1.0',  value: 1.0  }, { label: '1.15', value: 1.15 },
  { label: '1.5',  value: 1.5  }, { label: '1.8',  value: 1.8  },
  { label: '2.0',  value: 2.0  }, { label: '2.5',  value: 2.5  },
  { label: '3.0',  value: 3.0  },
];
const PAGE_SIZE_OPTIONS: PageSizeName[] = ['A4','A3','A5','A6','B4','B5','Letter','Legal','Custom'];

type ActiveTab = 'home' | 'insert' | 'layout' | 'review';

export default function WordRibbon({
  saveStatus, lastSavedTime, onAction, onExportPdf,
  fileName, token, getDocumentModel, exportOptions,
}: WordRibbonProps) {
  const imageInputRef  = useRef<HTMLInputElement>(null);
  const [activeTab,    setActiveTab]    = useState<ActiveTab>('home');
  const [showFind,     setShowFind]     = useState(false);
  const [findText,     setFindText]     = useState('');
  const [replaceText,  setReplaceText]  = useState('');
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tableHover,   setTableHover]   = useState({ rows: 0, cols: 0 });
  const [selectedFont, setSelectedFont] = useState('Pretendard Variable');
  const [fontSize,     setFontSize]     = useState(11);
  const [letterSpc,    setLetterSpc]    = useState(0);
  const [scaleX,       setScaleX]       = useState(100);
  const [spaceBefore,  setSpaceBefore]  = useState(0);
  const [spaceAfter,   setSpaceAfter]   = useState(8);
  const [marginTop,    setMarginTop]    = useState(25);
  const [marginBottom, setMarginBottom] = useState(25);
  const [marginLeft,   setMarginLeft]   = useState(30);
  const [marginRight,  setMarginRight]  = useState(30);
  const [headerText,   setHeaderText]   = useState('');
  const [footerText,   setFooterText]   = useState('');

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

  const tabLabel = (t: ActiveTab) => ({ home: '홈', insert: '삽입', layout: '레이아웃', review: '검토' }[t]);

  return (
    <div className={styles.ribbonRoot}>
      {/* ── Tab row ── */}
      <div className={styles.tabRow}>
        <span className={styles.brand}>Word</span>
        {(['home','insert','layout','review'] as ActiveTab[]).map(t => (
          <button key={t}
            className={`${styles.tab} ${activeTab === t ? styles.activeTab : ''}`}
            onClick={() => setActiveTab(t)}>
            {tabLabel(t)}
          </button>
        ))}
        {exportOptions && fileName && getDocumentModel ? (
          <ExportMenu fileName={fileName} token={token} getDocumentModel={getDocumentModel} options={exportOptions} />
        ) : (
          onExportPdf && <button className={styles.exportPdfBtn} onClick={onExportPdf}>PDF</button>
        )}
      </div>

      {/* ══════════ 홈 탭 ══════════ */}
      {activeTab === 'home' && (
        <div className={styles.toolRow}>
          {/* 되돌리기 */}
          <div className={styles.group}>
            <button className={styles.toolBtn} title="실행 취소 (Ctrl+Z)" onClick={() => onAction({ type: 'undo' })}>↩</button>
            <button className={styles.toolBtn} title="다시 실행 (Ctrl+Y)" onClick={() => onAction({ type: 'redo' })}>↪</button>
          </div>

          {/* 폰트 */}
          <div className={styles.group}>
            <FontPicker value={selectedFont} onChange={(f) => { setSelectedFont(f); onAction({ type: 'fontName', value: f }); }} />
            <FontSizePicker value={fontSize} onChange={(s) => { setFontSize(s); onAction({ type: 'fontSize', value: s }); }} />
          </div>

          {/* 글자 속성 */}
          <div className={styles.group}>
            <button className={styles.toolBtn} title="굵게 (Ctrl+B)" onClick={() => onAction({ type: 'bold' })}><b>B</b></button>
            <button className={styles.toolBtn} title="기울임 (Ctrl+I)" onClick={() => onAction({ type: 'italic' })}><em>I</em></button>
            <button className={styles.toolBtn} title="밑줄 (Ctrl+U)" onClick={() => onAction({ type: 'underline' })}>U̲</button>
            <button className={styles.toolBtn} title="취소선" onClick={() => onAction({ type: 'strikethrough' })}><s>S</s></button>
            <button className={styles.toolBtn} title="위첨자" onClick={() => onAction({ type: 'superscript' })} style={{ fontSize: '11px' }}>x<sup>2</sup></button>
            <button className={styles.toolBtn} title="아래첨자" onClick={() => onAction({ type: 'subscript' })} style={{ fontSize: '11px' }}>x<sub>2</sub></button>
          </div>

          {/* 색상 */}
          <div className={styles.group}>
            <label title="글자색" style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'11px', cursor:'pointer', color:'#a9b1d6' }}>
              A<input type="color" defaultValue="#000000" onChange={(e) => onAction({ type: 'textColor', value: e.target.value })} style={{ width:'22px', height:'22px', border:'none', padding:0, cursor:'pointer' }} />
            </label>
            <label title="형광펜" style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'11px', cursor:'pointer', color:'#a9b1d6' }}>
              🖊<input type="color" defaultValue="#fde68a" onChange={(e) => onAction({ type: 'highlightColor', value: e.target.value })} style={{ width:'22px', height:'22px', border:'none', padding:0, cursor:'pointer' }} />
            </label>
          </div>

          {/* 정렬 */}
          <div className={styles.group}>
            <button className={styles.toolBtn} title="왼쪽 (Ctrl+L)" onClick={() => onAction({ type: 'align', value: 'left' })}>≡←</button>
            <button className={styles.toolBtn} title="가운데 (Ctrl+E)" onClick={() => onAction({ type: 'align', value: 'center' })}>≡↔</button>
            <button className={styles.toolBtn} title="오른쪽 (Ctrl+R)" onClick={() => onAction({ type: 'align', value: 'right' })}>≡→</button>
            <button className={styles.toolBtn} title="양쪽 (Ctrl+J)" onClick={() => onAction({ type: 'align', value: 'justify' })}>⇔</button>
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

          {/* 자간 */}
          <div className={styles.group}>
            <label title="자간" style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', color:'#a9b1d6' }}>
              자간
              <input type="range" min={-10} max={30} step={1} value={Math.round(letterSpc * 100)}
                onChange={(e) => { const v = Number(e.target.value)/100; setLetterSpc(v); onAction({ type: 'letterSpacing', value: v }); }}
                style={{ width:'56px' }} />
              <span style={{ fontSize:'10px', color:'#7aa2f7', minWidth:'28px' }}>{Math.round(letterSpc * 100)}%</span>
            </label>
          </div>

          {/* 장평 */}
          <div className={styles.group}>
            <label title="장평" style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', color:'#a9b1d6' }}>
              장평
              <input type="range" min={50} max={200} step={1} value={scaleX}
                onChange={(e) => { const v = Number(e.target.value); setScaleX(v); onAction({ type: 'textScaleX', value: v }); }}
                style={{ width:'56px' }} />
              <span style={{ fontSize:'10px', color:'#7aa2f7', minWidth:'28px' }}>{scaleX}%</span>
            </label>
          </div>

          {/* 문단 간격 */}
          <div className={styles.group}>
            <label title="문단 위 간격" style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'11px', color:'#a9b1d6' }}>
              문↑
              <input type="number" min={0} max={200} value={spaceBefore}
                onChange={(e) => { const v=Number(e.target.value); setSpaceBefore(v); onAction({ type: 'paragraphSpacingBefore', value: v }); }}
                style={{ width:'38px', padding:'2px 3px', borderRadius:'4px', border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:'11px' }} />
            </label>
            <label title="문단 아래 간격" style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'11px', color:'#a9b1d6' }}>
              문↓
              <input type="number" min={0} max={200} value={spaceAfter}
                onChange={(e) => { const v=Number(e.target.value); setSpaceAfter(v); onAction({ type: 'paragraphSpacingAfter', value: v }); }}
                style={{ width:'38px', padding:'2px 3px', borderRadius:'4px', border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:'11px' }} />
            </label>
          </div>

          {/* 단락 */}
          <div className={styles.group}>
            <button className={styles.toolBtn} title="단락 추가" onClick={() => onAction({ type: 'addParagraph' })}>+ 단락</button>
            <button className={styles.toolBtn} title="단락 삭제" onClick={() => onAction({ type: 'deleteParagraph' })}>− 단락</button>
            <button className={styles.toolBtn} title="페이지 나누기" onClick={() => onAction({ type: 'pageBreak' })}>⊞ 쪽</button>
          </div>

          {/* 삽입 */}
          <div className={styles.group}>
            <div style={{ position: 'relative' }}>
              <button className={styles.toolBtn} title="표 삽입" onClick={() => setShowTablePicker(v => !v)}>⊞ 표</button>
              {showTablePicker && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 9999,
                  background: '#1e1f2e', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px', padding: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}>
                  <div style={{ fontSize: '11px', color: '#7aa2f7', marginBottom: '6px' }}>
                    {tableHover.rows > 0 ? `${tableHover.rows} × ${tableHover.cols}` : '표 크기 선택'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,18px)', gap: '2px' }}>
                    {Array.from({ length: 64 }).map((_, i) => {
                      const r = Math.floor(i / 8) + 1, c = (i % 8) + 1;
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
            <button className={styles.toolBtn} title="그림 삽입" onClick={handleInsertImage}>🖼 그림</button>
          </div>

          {/* 찾기/서식 초기화 */}
          <div className={styles.group}>
            <button className={styles.toolBtn} title="찾아 바꾸기" onClick={() => setShowFind(v => !v)}>🔍 찾기</button>
            <button className={styles.toolBtn} title="서식 초기화" onClick={() => onAction({ type: 'clearFormatting' })}>🚫 서식</button>
          </div>

          <SaveStatusIndicator saveStatus={saveStatus} lastSavedTime={lastSavedTime} />
        </div>
      )}

      {/* ══════════ 레이아웃 탭 ══════════ */}
      {activeTab === 'layout' && (
        <div className={styles.toolRow}>
          {/* 페이지 크기 */}
          <div className={styles.group}>
            <label style={{ fontSize:'11px', color:'#a9b1d6', marginRight:'4px' }}>용지</label>
            <select className={styles.select} defaultValue="A4"
              onChange={(e) => onAction({ type: 'setPageSize', value: e.target.value as PageSizeName })}>
              {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* 방향 */}
          <div className={styles.group}>
            <button className={styles.toolBtn} title="세로 방향" onClick={() => onAction({ type: 'setOrientation', value: 'portrait' as PageOrientation })}>
              ▯ 세로
            </button>
            <button className={styles.toolBtn} title="가로 방향" onClick={() => onAction({ type: 'setOrientation', value: 'landscape' as PageOrientation })}>
              ▭ 가로
            </button>
          </div>

          {/* 여백 */}
          <div className={styles.group}>
            {[
              { label: '위', value: marginTop,    setter: setMarginTop,    key: 'top'    },
              { label: '아래', value: marginBottom, setter: setMarginBottom, key: 'bottom' },
              { label: '왼쪽', value: marginLeft,   setter: setMarginLeft,   key: 'left'   },
              { label: '오른쪽', value: marginRight, setter: setMarginRight, key: 'right'  },
            ].map(({ label, value, setter, key }) => (
              <label key={key} style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'11px', color:'#a9b1d6' }}>
                {label}
                <input type="number" min={0} max={100} value={value}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setter(v);
                    onAction({ type: 'setMargins', value: { [key]: v } });
                  }}
                  style={{ width:'38px', padding:'2px 3px', borderRadius:'4px', border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:'11px' }}
                />mm
              </label>
            ))}
          </div>

          {/* 다단 */}
          <div className={styles.group}>
            <label style={{ fontSize:'11px', color:'#a9b1d6' }}>다단</label>
            <select className={styles.select} defaultValue="1"
              onChange={(e) => onAction({ type: 'setColumns', value: Number(e.target.value) })}>
              {[1,2,3].map(n => <option key={n} value={n}>{n}단</option>)}
            </select>
          </div>

          {/* 머리글/바닥글 */}
          <div className={styles.group}>
            <label style={{ fontSize:'11px', color:'#a9b1d6', display:'flex', alignItems:'center', gap:'4px' }}>
              머리글
              <input type="text" value={headerText} placeholder="머리글 입력"
                onChange={(e) => setHeaderText(e.target.value)}
                onBlur={(e) => onAction({ type: 'setHeaderText', value: e.target.value })}
                style={{ width:'100px', padding:'2px 6px', borderRadius:'4px', border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:'11px' }}
              />
            </label>
            <label style={{ fontSize:'11px', color:'#a9b1d6', display:'flex', alignItems:'center', gap:'4px' }}>
              바닥글
              <input type="text" value={footerText} placeholder="바닥글 입력"
                onChange={(e) => setFooterText(e.target.value)}
                onBlur={(e) => onAction({ type: 'setFooterText', value: e.target.value })}
                style={{ width:'100px', padding:'2px 6px', borderRadius:'4px', border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:'11px' }}
              />
            </label>
          </div>

          <SaveStatusIndicator saveStatus={saveStatus} lastSavedTime={lastSavedTime} />
        </div>
      )}

      {/* ══════════ 삽입 탭 ══════════ */}
      {activeTab === 'insert' && (
        <div className={styles.toolRow}>
          <div className={styles.group}>
            <div style={{ position: 'relative' }}>
              <button className={styles.toolBtn} onClick={() => setShowTablePicker(v => !v)}>⊞ 표</button>
              {showTablePicker && (
                <div style={{ position:'absolute', top:'100%', left:0, zIndex:9999, background:'#1e1f2e', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'8px', padding:'8px', boxShadow:'0 8px 24px rgba(0,0,0,0.5)' }}>
                  <div style={{ fontSize:'11px', color:'#7aa2f7', marginBottom:'6px' }}>{tableHover.rows > 0 ? `${tableHover.rows} × ${tableHover.cols}` : '표 크기'}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(8,18px)', gap:'2px' }}>
                    {Array.from({ length: 64 }).map((_, i) => {
                      const r=Math.floor(i/8)+1, c=(i%8)+1, active=r<=tableHover.rows&&c<=tableHover.cols;
                      return <div key={i} style={{ width:16, height:16, border:'1px solid', borderColor:active?'#7aa2f7':'#3a3b4e', background:active?'rgba(122,162,247,0.2)':'transparent', borderRadius:'2px', cursor:'pointer' }}
                        onMouseEnter={()=>setTableHover({rows:r,cols:c})}
                        onClick={()=>{onAction({type:'insertTable',rows:r,cols:c});setShowTablePicker(false);}}/>;
                    })}
                  </div>
                </div>
              )}
            </div>
            <input ref={imageInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleImageFile} />
            <button className={styles.toolBtn} onClick={handleInsertImage}>🖼 그림</button>
            <button className={styles.toolBtn} onClick={() => onAction({ type: 'pageBreak' })}>⊞ 쪽 나누기</button>
          </div>
          <SaveStatusIndicator saveStatus={saveStatus} lastSavedTime={lastSavedTime} />
        </div>
      )}

      {/* ══════════ 검토 탭 ══════════ */}
      {activeTab === 'review' && (
        <div className={styles.toolRow}>
          <div className={styles.group}>
            <button className={styles.toolBtn} onClick={() => setShowFind(v => !v)}>🔍 찾아 바꾸기</button>
            <button className={styles.toolBtn} onClick={() => onAction({ type: 'clearFormatting' })}>🚫 서식 초기화</button>
          </div>
          <SaveStatusIndicator saveStatus={saveStatus} lastSavedTime={lastSavedTime} />
        </div>
      )}

      {/* ══════════ 찾기/바꾸기 패널 ══════════ */}
      {showFind && (
        <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 12px', background:'rgba(122,162,247,0.06)', borderTop:'1px solid rgba(255,255,255,0.06)', fontSize:'12px', flexWrap:'wrap' }}>
          <span style={{ color:'#7aa2f7' }}>찾기:</span>
          <input value={findText} onChange={e => setFindText(e.target.value)} placeholder="찾을 내용"
            style={{ padding:'3px 8px', borderRadius:'6px', border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:'12px', width:'140px' }} />
          <span style={{ color:'#7aa2f7' }}>바꿀 내용:</span>
          <input value={replaceText} onChange={e => setReplaceText(e.target.value)} placeholder="바꿀 내용"
            style={{ padding:'3px 8px', borderRadius:'6px', border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:'12px', width:'140px' }} />
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'find', value: findText })}>찾기</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'replace', find: findText, replace: replaceText })}>모두 바꾸기</button>
          <button className={styles.toolBtn} onClick={() => setShowFind(false)} style={{ marginLeft:'auto' }}>✕</button>
        </div>
      )}
    </div>
  );
}
