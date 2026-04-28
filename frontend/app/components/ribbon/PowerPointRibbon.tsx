'use client';

import React, { useRef, useState } from 'react';
import styles from './OfficeRibbon.module.css';
import { SaveStatus, PresentationToolAction } from '../../types/document';
import SaveStatusIndicator from './SaveStatusIndicator';
import ExportMenu, { ExportOption } from './ExportMenu';
import FontPicker from './FontPicker';

interface PowerPointRibbonProps {
  saveStatus: SaveStatus;
  lastSavedTime: string;
  onAction: (action: PresentationToolAction) => void;
  onExportPdf?: () => void;
  fileName?: string;
  token?: string;
  getDocumentModel?: () => object | null;
  exportOptions?: ExportOption[];
}

const TRANSITIONS = [
  { label: '없음', value: 'none' as const },
  { label: '페이드', value: 'fade' as const },
  { label: '슬라이드', value: 'slide' as const },
  { label: '줌', value: 'zoom' as const },
];

export default function PowerPointRibbon({
  saveStatus, lastSavedTime, onAction, onExportPdf,
  fileName, token, getDocumentModel, exportOptions,
}: PowerPointRibbonProps) {
  const imageInputRef        = useRef<HTMLInputElement | null>(null);
  const imageReplaceInputRef = useRef<HTMLInputElement | null>(null);
  const bgImageInputRef      = useRef<HTMLInputElement | null>(null);

  const [opacityVal,   setOpacityVal]   = useState(100);
  const [rotationVal,  setRotationVal]  = useState(0);
  const [selectedFont, setSelectedFont] = useState('Pretendard Variable');

  // ── Image handlers ──────────────────────────────────────────────────────────
  const handleInsertImage = () => imageInputRef.current?.click();
  const handleReplaceImage = () => imageReplaceInputRef.current?.click();
  const handleBgImage = () => bgImageInputRef.current?.click();

  const readFile = (file: File, cb: (result: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') cb(reader.result); };
    reader.readAsDataURL(file);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file, (result) => onAction({ type: 'addImage', value: result }));
    e.currentTarget.value = '';
  };

  const handleReplaceImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file, (result) => onAction({ type: 'replaceSelectedImage', value: result }));
    e.currentTarget.value = '';
  };

  const handleBgImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file, (result) => onAction({ type: 'setSlideBackgroundImage', value: result }));
    e.currentTarget.value = '';
  };

  const handleNudge = (dx: number, dy: number) => onAction({ type: 'nudgeShape', dx, dy });

  return (
    <div className={styles.ribbonRoot}>
      {/* ── Tab Row ── */}
      <div className={styles.tabRow}>
        <span className={styles.brand}>PowerPoint</span>
        <button className={`${styles.tab} ${styles.activeTab}`}>홈</button>
        <button className={styles.tab}>삽입</button>
        <button className={styles.tab}>디자인</button>
        <button className={styles.tab}>전환</button>
        <button className={styles.tab}>애니메이션</button>
        <button className={styles.tab}>슬라이드 쇼</button>
        <button className={styles.tab}>검토</button>
        <button className={styles.tab}>보기</button>
        {exportOptions && fileName && getDocumentModel ? (
          <ExportMenu fileName={fileName} token={token} getDocumentModel={getDocumentModel} options={exportOptions} />
        ) : (
          onExportPdf && <button className={styles.exportPdfBtn} onClick={onExportPdf}>Print (PDF)</button>
        )}
      </div>

      {/* ── Hidden file inputs ── */}
      <input ref={imageInputRef}        type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFileChange} />
      <input ref={imageReplaceInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleReplaceImageFileChange} />
      <input ref={bgImageInputRef}      type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgImageFileChange} />

      {/* ── Tool Row ── */}
      <div className={styles.toolRow}>

        {/* 되돌리기 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} title="실행 취소" onClick={() => onAction({ type: 'undo' })}>↩</button>
          <button className={styles.toolBtn} title="다시 실행" onClick={() => onAction({ type: 'redo' })}>↪</button>
        </div>

        {/* 슬라이드 관리 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'prevSlide' })}>◀ 이전</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'nextSlide' })}>다음 ▶</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'addSlide' })}>+ 슬라이드</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'duplicateSlide' })}>⊕ 복제</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'deleteSlide' })}>🗑 삭제</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'moveSlideUp' })}>↑ 위로</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'moveSlideDown' })}>↓ 아래로</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'toggleSlideVisibility' })}>👁 숨기기</button>

          <select className={styles.select} defaultValue="" onChange={(e) => {
            const layout = e.target.value as 'title' | 'titleContent' | 'twoContent' | 'sectionHeader' | 'blank' | '';
            if (layout) { onAction({ type: 'applySlideLayout', layout }); e.target.value = ''; }
          }}>
            <option value="" disabled>레이아웃</option>
            <option value="title">제목 슬라이드</option>
            <option value="titleContent">제목 + 내용</option>
            <option value="twoContent">두 콘텐츠</option>
            <option value="sectionHeader">섹션 헤더</option>
            <option value="blank">빈 슬라이드</option>
          </select>
        </div>

        {/* 배경 */}
        <div className={styles.group}>
          <label title="슬라이드 배경색" style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', cursor: 'pointer' }}>
            배경<input type="color" defaultValue="#ffffff" onChange={(e) => onAction({ type: 'setSlideBackground', value: e.target.value })} style={{ width: '22px', height: '22px', border: 'none', padding: 0 }} />
          </label>
          <button className={styles.toolBtn} title="배경 이미지" onClick={handleBgImage}>🖼 배경이미지</button>
          <select className={styles.select} defaultValue="none" onChange={(e) => onAction({ type: 'setSlideTransition', value: e.target.value as 'none' | 'fade' | 'slide' | 'zoom' })}>
            {TRANSITIONS.map(t => <option key={t.value} value={t.value}>{t.label} 전환</option>)}
          </select>
        </div>

        {/* 도형 삽입 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'addShape' })}>Ⓣ 텍스트</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'addRect' })}>▭ 사각형</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'addEllipse' })}>◯ 타원</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'addTriangle' })}>△ 삼각형</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'addRightArrow' })}>➡ 화살표</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'addHexagon' })}>⬡ 육각형</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'addStar' })}>★ 별</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'addRoundRect' })}>▢ 둥근사각</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'addLine' })}>╱ 선</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'addCallout' })}>💬 말풍선</button>
          <button className={styles.toolBtn} onClick={handleInsertImage}>🖼 이미지</button>
          <button className={styles.toolBtn} onClick={handleReplaceImage}>↺ 이미지교체</button>
        </div>

        {/* 텍스트 서식 */}
        <div className={styles.group}>
          <FontPicker value={selectedFont} onChange={(f) => { setSelectedFont(f); onAction({ type: 'fontName', value: f }); }} />
          <select className={styles.select} style={{ width: '52px' }} onChange={(e) => onAction({ type: 'fontSize', value: Number(e.target.value) })}>
            {[12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 60, 72].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'bold' })}><b>B</b></button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'italic' })}><i>I</i></button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'underline' })}>U̲</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'bullet' })}>• 목록</button>
          <label title="글자색" style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '11px', cursor: 'pointer' }}>
            A<input type="color" defaultValue="#000000" onChange={(e) => onAction({ type: 'textColor', value: e.target.value })} style={{ width: '20px', height: '20px', border: 'none', padding: 0 }} />
          </label>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'align', value: 'left' })}>≡←</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'align', value: 'center' })}>≡↔</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'align', value: 'right' })}>≡→</button>
        </div>

        {/* 도형 스타일 */}
        <div className={styles.group}>
          <label title="채우기" style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', cursor: 'pointer' }}>
            채우기<input type="color" onChange={(e) => onAction({ type: 'setShapeFillColor', value: e.target.value })} style={{ width: '20px', height: '20px', border: 'none', padding: 0 }} />
          </label>
          <label title="테두리" style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', cursor: 'pointer' }}>
            테두리<input type="color" onChange={(e) => onAction({ type: 'setShapeBorderColor', value: e.target.value })} style={{ width: '20px', height: '20px', border: 'none', padding: 0 }} />
          </label>
          <select className={styles.select} defaultValue="2" onChange={(e) => onAction({ type: 'setShapeBorderWidth', value: Number(e.target.value) })}>
            {[0, 1, 2, 3, 4, 6, 8].map(w => <option key={w} value={w}>{w}px</option>)}
          </select>
          {/* 불투명도 */}
          <label title="불투명도" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
            투명
            <input type="range" min={0} max={100} value={opacityVal}
              onChange={(e) => { setOpacityVal(Number(e.target.value)); onAction({ type: 'setShapeOpacity', value: Number(e.target.value) / 100 }); }}
              style={{ width: '60px' }} />
            <span style={{ fontSize: '10px', color: '#7aa2f7', minWidth: '26px' }}>{opacityVal}%</span>
          </label>
          {/* 회전 */}
          <label title="회전" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
            회전
            <input type="number" min={-360} max={360} value={rotationVal}
              onChange={(e) => { setRotationVal(Number(e.target.value)); onAction({ type: 'setShapeRotation', value: Number(e.target.value) }); }}
              style={{ width: '50px', padding: '2px 4px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '11px' }} />°
          </label>
          <select className={styles.select} defaultValue="cover" onChange={(e) => onAction({ type: 'setImageFit', value: e.target.value as 'cover' | 'contain' | 'fill' })}>
            <option value="cover">이미지 Cover</option>
            <option value="contain">이미지 Contain</option>
            <option value="fill">이미지 Fill</option>
          </select>
        </div>

        {/* 도형 정렬 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'alignOnSlide', value: 'left' })}>슬Left</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'alignOnSlide', value: 'center' })}>슬Ctr</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'alignOnSlide', value: 'right' })}>슬Right</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'alignOnSlide', value: 'top' })}>슬Top</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'alignOnSlide', value: 'middle' })}>슬Mid</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'alignOnSlide', value: 'bottom' })}>슬Bot</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'bringToFront' })}>앞으로</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'sendToBack' })}>뒤로</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'distributeShapes', direction: 'horizontal' })}>H분배</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'distributeShapes', direction: 'vertical' })}>V분배</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'groupShapes' })}>그룹</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'ungroupShapes' })}>그룹해제</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'lockShape' })}>🔒 잠금</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'duplicateShape' })}>⊕ 복제</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'deleteShape' })}>🗑 삭제</button>
        </div>

        {/* 미세 이동 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} onClick={() => handleNudge(-10, 0)}>◀10</button>
          <button className={styles.toolBtn} onClick={() => handleNudge(10, 0)}>10▶</button>
          <button className={styles.toolBtn} onClick={() => handleNudge(0, -10)}>▲10</button>
          <button className={styles.toolBtn} onClick={() => handleNudge(0, 10)}>10▼</button>
        </div>

        {/* 보기/발표 */}
        <div className={styles.group}>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'zoomIn' })}>🔍+</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'zoomOut' })}>🔍−</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'togglePresentMode' })}>▶ 발표</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'aiTranslate' })}>🌐 AI번역</button>
        </div>

        <SaveStatusIndicator saveStatus={saveStatus} lastSavedTime={lastSavedTime} />
      </div>
    </div>
  );
}
