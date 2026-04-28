import React from 'react';
import styles from './OfficeRibbon.module.css';
import { SaveStatus, PresentationToolAction } from '../../types/document';
import SaveStatusIndicator from './SaveStatusIndicator';

interface PowerPointRibbonProps {
  saveStatus: SaveStatus;
  lastSavedTime: string;
  onAction: (action: PresentationToolAction) => void;
  onExportPdf?: () => void;
}

export default function PowerPointRibbon({ saveStatus, lastSavedTime, onAction, onExportPdf }: PowerPointRibbonProps) {
  const handleInsertImage = () => {
    const url = window.prompt('이미지 URL 또는 data URL을 입력하세요.');
    if (!url) return;
    onAction({ type: 'addImage', value: url });
  };

  const handleNudge = (dx: number, dy: number) => {
    onAction({ type: 'nudgeShape', dx, dy });
  };

  return (
    <div className={styles.ribbonRoot}>
      <div className={styles.tabRow}>
        <span className={styles.brand}>PowerPoint Ribbon</span>
        <button className={`${styles.tab} ${styles.activeTab}`}>Home</button>
        <button className={styles.tab}>Insert</button>
        <button className={styles.tab}>Design</button>
        <button className={styles.tab}>Transitions</button>
        <button className={styles.tab}>Animations</button>
        <button className={styles.tab}>Slide Show</button>
        <button className={styles.tab}>Review</button>
        <button className={styles.tab}>View</button>
        {onExportPdf && <button className={styles.exportPdfBtn} onClick={onExportPdf}>Print (PDF)</button>}
      </div>

      <div className={styles.toolRow}>
        <div className={styles.group}>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'prevSlide' })}>Prev</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'nextSlide' })}>Next</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'addSlide' })}>New Slide</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'duplicateSlide' })}>Duplicate</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'deleteSlide' })}>Delete</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'moveSlideUp' })}>Move Up</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'moveSlideDown' })}>Move Down</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'toggleSlideVisibility' })}>Hide/Show</button>
        </div>

        <div className={styles.group}>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'addShape' })}>Text Box</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'addRect' })}>Rectangle</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'addEllipse' })}>Ellipse</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'addTriangle' })}>Triangle</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'addRightArrow' })}>Arrow</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'addHexagon' })}>Hexagon</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'addStar' })}>Star</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'addRoundRect' })}>Round</button>
          <button className={styles.toolBtn} onClick={handleInsertImage}>Image</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'duplicateShape' })}>Duplicate Shape</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'deleteShape' })}>Delete Shape</button>
        </div>

        <div className={styles.group}>
          <select className={styles.select} onChange={(e) => onAction({ type: 'fontName', value: e.target.value })}>
            <option value="Calibri">Calibri</option>
            <option value="Arial">Arial</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="NanumGothic">NanumGothic</option>
          </select>
          <select className={styles.select} onChange={(e) => onAction({ type: 'fontSize', value: Number(e.target.value) })}>
            {[12, 14, 16, 18, 20, 24, 28, 32, 40].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'bold' })}>B</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'italic' })}>I</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'underline' })}>U</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'bullet' })}>Bullet</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'textColor', value: '#1d4ed8' })}>Blue</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'textColor', value: '#dc2626' })}>Red</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'align', value: 'left' })}>Left</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'align', value: 'center' })}>Center</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'align', value: 'right' })}>Right</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'align', value: 'justify' })}>Justify</button>
        </div>

        <div className={styles.group}>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'alignOnSlide', value: 'left' })}>Slide Left</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'alignOnSlide', value: 'center' })}>Slide Center</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'alignOnSlide', value: 'right' })}>Slide Right</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'alignOnSlide', value: 'top' })}>Top</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'alignOnSlide', value: 'middle' })}>Middle</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'alignOnSlide', value: 'bottom' })}>Bottom</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'bringToFront' })}>Bring Front</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'sendToBack' })}>Send Back</button>
        </div>

        <div className={styles.group}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
            Fill
            <input type="color" onChange={(e) => onAction({ type: 'setShapeFillColor', value: e.target.value })} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
            Border
            <input type="color" onChange={(e) => onAction({ type: 'setShapeBorderColor', value: e.target.value })} />
          </label>
          <select className={styles.select} defaultValue="2" onChange={(e) => onAction({ type: 'setShapeBorderWidth', value: Number(e.target.value) })}>
            {[0, 1, 2, 3, 4, 6, 8].map((width) => (
              <option key={width} value={width}>Border {width}px</option>
            ))}
          </select>
          <button className={styles.toolBtn} onClick={() => handleNudge(-10, 0)}>◀10</button>
          <button className={styles.toolBtn} onClick={() => handleNudge(10, 0)}>10▶</button>
          <button className={styles.toolBtn} onClick={() => handleNudge(0, -10)}>▲10</button>
          <button className={styles.toolBtn} onClick={() => handleNudge(0, 10)}>10▼</button>
        </div>

        <div className={styles.group}>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'togglePresentMode' })}>Present</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'aiTranslate' })}>AI Translate</button>
        </div>

        <SaveStatusIndicator saveStatus={saveStatus} lastSavedTime={lastSavedTime} />
      </div>
    </div>
  );
}
