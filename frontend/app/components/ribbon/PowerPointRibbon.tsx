import React, { useRef } from 'react';
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
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const imageReplaceInputRef = useRef<HTMLInputElement | null>(null);

  const handleInsertImage = () => {
    imageInputRef.current?.click();
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        onAction({ type: 'addImage', value: result });
      }
    };
    reader.readAsDataURL(file);

    e.currentTarget.value = '';
  };

  const handleReplaceImage = () => {
    imageReplaceInputRef.current?.click();
  };

  const handleReplaceImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        onAction({ type: 'replaceSelectedImage', value: result });
      }
    };
    reader.readAsDataURL(file);

    e.currentTarget.value = '';
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
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageFileChange}
        />
        <input
          ref={imageReplaceInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleReplaceImageFileChange}
        />

        <div className={styles.group}>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'prevSlide' })}>Prev</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'nextSlide' })}>Next</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'addSlide' })}>New Slide</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'duplicateSlide' })}>Duplicate</button>
          <select className={styles.select} defaultValue="" onChange={(e) => {
            const layout = e.target.value as 'title' | 'titleContent' | 'twoContent' | 'sectionHeader' | 'blank' | '';
            if (!layout) return;
            onAction({ type: 'applySlideLayout', layout });
          }}>
            <option value="" disabled>Layout</option>
            <option value="title">Title Slide</option>
            <option value="titleContent">Title + Content</option>
            <option value="twoContent">Two Content</option>
            <option value="sectionHeader">Section Header</option>
            <option value="blank">Blank</option>
          </select>
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
          <button className={styles.toolBtn} onClick={handleReplaceImage}>Replace Image</button>
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
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'alignInSelection', value: 'left' })}>Sel Left</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'alignInSelection', value: 'center' })}>Sel Center</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'alignInSelection', value: 'right' })}>Sel Right</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'alignInSelection', value: 'top' })}>Sel Top</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'alignInSelection', value: 'middle' })}>Sel Middle</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'alignInSelection', value: 'bottom' })}>Sel Bottom</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'bringToFront' })}>Bring Front</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'sendToBack' })}>Send Back</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'distributeShapes', direction: 'horizontal' })}>Distribute H</button>
          <button className={styles.toolBtn} onClick={() => onAction({ type: 'distributeShapes', direction: 'vertical' })}>Distribute V</button>
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
          <select className={styles.select} defaultValue="cover" onChange={(e) => onAction({ type: 'setImageFit', value: e.target.value as 'cover' | 'contain' | 'fill' })}>
            <option value="cover">Image Cover</option>
            <option value="contain">Image Contain</option>
            <option value="fill">Image Fill</option>
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
