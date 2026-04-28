'use client';

import React, { useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import styles from './SlideNavigator.module.css';
import {
  PresentationSlide,
  PresentationToolAction,
  SlideShape,
} from '../types/document';

interface SlideNavigatorProps {
  slides: PresentationSlide[];
  onTextChange: (slideIdx: number, shapeIdx: number, newText: string) => void;
  onShapeFormatChange: (slideIdx: number, shapeIdx: number, shape: SlideShape) => void;
  onSlideAdd: (afterIdx: number) => void;
  onSlideDelete: (slideIdx: number) => void;
  onShapeAdd: (slideIdx: number, type?: string, imageUrl?: string) => void;
  onShapeDelete: (slideIdx: number, shapeIdx: number) => void;
  onSlideMove: (slideIdx: number, direction: 'up' | 'down') => void;
  onSlideToggleVisibility: (slideIdx: number) => void;
  onSlideNotesUpdate: (slideIdx: number, notes: string) => void;
  onAITranslate?: (slideIdx: number) => void;
}

export interface SlideNavigatorHandle {
  applyAction: (action: PresentationToolAction) => void;
}

/**
 * SlideNavigator: Renders PowerPoint slides with editable text shapes.
 * Supports slide-by-slide navigation and text editing within shapes.
 */
const SlideNavigator = forwardRef<SlideNavigatorHandle, SlideNavigatorProps>(function SlideNavigator(
  { slides, onTextChange, onShapeFormatChange, onSlideAdd, onSlideDelete, onShapeAdd, onShapeDelete, onSlideMove, onSlideToggleVisibility, onSlideNotesUpdate, onAITranslate }: SlideNavigatorProps,
  ref
) {
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [editingShape, setEditingShape] = useState<{ shape: number; text: string } | null>(null);
  const [selectedShapeIdx, setSelectedShapeIdx] = useState<number | null>(null);
  const [dragState, setDragState] = useState<{ shapeIdx: number; startX: number; startY: number; initX: number; initY: number } | null>(null);
  const [isPresentMode, setIsPresentMode] = useState(false);

  const activeSlide = slides[activeSlideIdx];

  const handleShapeClick = (shapeIdx: number, currentText: string) => {
    // Only go into edit mode on double click or specific edit button, but for parity, 
    // click will select, double click will edit. For now, let's keep click for edit if not dragging.
    setSelectedShapeIdx(shapeIdx);
  };

  const handleShapeDoubleClick = (shapeIdx: number, currentText: string) => {
    setEditingShape({ shape: shapeIdx, text: currentText });
  };

  const handlePointerDown = (e: React.PointerEvent, shapeIdx: number, shape: SlideShape) => {
    if (editingShape?.shape === shapeIdx) return;
    
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragState({
      shapeIdx,
      startX: e.clientX,
      startY: e.clientY,
      initX: shape.x,
      initY: shape.y
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    
    const shape = slides[activeSlideIdx].shapes[dragState.shapeIdx];
    onShapeFormatChange(activeSlideIdx, dragState.shapeIdx, {
      ...shape,
      x: dragState.initX + dx,
      y: dragState.initY + dy
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragState) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setDragState(null);
    }
  };

  const handleTextSave = useCallback(() => {
    if (editingShape !== null) {
      onTextChange(activeSlideIdx, editingShape.shape, editingShape.text);
      setEditingShape(null);
    }
  }, [editingShape, activeSlideIdx, onTextChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleTextSave();
    } else if (e.key === 'Escape') {
      setEditingShape(null);
    }
  };

  const handlePrevSlide = () => {
    setActiveSlideIdx(Math.max(0, activeSlideIdx - 1));
    setEditingShape(null);
  };

  const handleNextSlide = () => {
    setActiveSlideIdx(Math.min(slides.length - 1, activeSlideIdx + 1));
    setSelectedShapeIdx(null);
    setEditingShape(null);
  };

  useImperativeHandle(ref, () => ({
    applyAction: (action: PresentationToolAction) => {
      if (action.type === 'nextSlide') {
        setActiveSlideIdx((prev) => Math.min(slides.length - 1, prev + 1));
        setSelectedShapeIdx(null);
        return;
      }

      if (action.type === 'prevSlide') {
        setActiveSlideIdx((prev) => Math.max(0, prev - 1));
        setSelectedShapeIdx(null);
        return;
      }

      if (action.type === 'addSlide') {
        onSlideAdd(activeSlideIdx);
        setActiveSlideIdx(activeSlideIdx + 1);
        setSelectedShapeIdx(null);
        return;
      }

      if (action.type === 'deleteSlide') {
        onSlideDelete(activeSlideIdx);
        setActiveSlideIdx(Math.max(0, activeSlideIdx - 1));
        setSelectedShapeIdx(null);
        return;
      }

      if (action.type === 'moveSlideUp') {
        if (activeSlideIdx > 0) {
          onSlideMove(activeSlideIdx, 'up');
          setActiveSlideIdx(activeSlideIdx - 1);
          setSelectedShapeIdx(null);
        }
        return;
      }

      if (action.type === 'moveSlideDown') {
        if (activeSlideIdx < slides.length - 1) {
          onSlideMove(activeSlideIdx, 'down');
          setActiveSlideIdx(activeSlideIdx + 1);
          setSelectedShapeIdx(null);
        }
        return;
      }

      if (action.type === 'toggleSlideVisibility') {
        onSlideToggleVisibility(activeSlideIdx);
        return;
      }

      if (action.type === 'updateNotes') {
        onSlideNotesUpdate(activeSlideIdx, action.value);
        return;
      }

      if (action.type === 'addShape') {
        onShapeAdd(activeSlideIdx, 'text');
        return;
      }

      if (action.type === 'addRect') {
        onShapeAdd(activeSlideIdx, 'rect');
        return;
      }

      if (action.type === 'addEllipse') {
        onShapeAdd(activeSlideIdx, 'ellipse');
        return;
      }

      if (action.type === 'addTriangle') {
        onShapeAdd(activeSlideIdx, 'triangle');
        return;
      }

      if (action.type === 'addRightArrow') {
        onShapeAdd(activeSlideIdx, 'right_arrow');
        return;
      }

      if (action.type === 'addHexagon') {
        onShapeAdd(activeSlideIdx, 'hexagon');
        return;
      }

      if (action.type === 'addStar') {
        onShapeAdd(activeSlideIdx, 'star');
        return;
      }

      if (action.type === 'addRoundRect') {
        onShapeAdd(activeSlideIdx, 'round_rect');
        return;
      }

      if (action.type === 'addImage') {
        onShapeAdd(activeSlideIdx, 'image', action.value);
        return;
      }

      if (action.type === 'togglePresentMode') {
        setIsPresentMode(!isPresentMode);
        return;
      }

      if (action.type === 'aiTranslate') {
        if (onAITranslate) onAITranslate(activeSlideIdx);
        return;
      }

      if (action.type === 'deleteShape') {
        if (selectedShapeIdx !== null) {
          onShapeDelete(activeSlideIdx, selectedShapeIdx);
          setSelectedShapeIdx(null);
        }
        return;
      }

      if (selectedShapeIdx === null) {
        return;
      }

      const currentShape = slides[activeSlideIdx]?.shapes?.[selectedShapeIdx];
      if (!currentShape) {
        return;
      }

      const nextShape: SlideShape = {
        ...currentShape,
        formatting: {
          ...currentShape.formatting,
        },
      };

      if (action.type === 'bold' || action.type === 'italic' || action.type === 'underline') {
        const key = action.type;
        nextShape.formatting[key] = !nextShape.formatting[key];
      }

      if (action.type === 'fontSize') {
        nextShape.formatting.fontSize = action.value;
      }

      if (action.type === 'fontName') {
        nextShape.formatting.fontName = action.value;
      }

      if (action.type === 'textColor') {
        nextShape.formatting.color = action.value;
      }

      if (action.type === 'align') {
        nextShape.formatting.align = action.value;
      }

      if (action.type === 'bullet') {
        nextShape.formatting.bullet = !nextShape.formatting.bullet;
      }

      onShapeFormatChange(activeSlideIdx, selectedShapeIdx, nextShape);
    },
  }), [slides, activeSlideIdx, selectedShapeIdx, onShapeFormatChange]);

  if (!activeSlide) {
    return <div className={styles.container}>No slides available</div>;
  }

  return (
    <div className={styles.container}>
      {/* Slide Navigation */}
      <div className={styles.navBar}>
        <button 
          className={styles.navBtn} 
          onClick={handlePrevSlide}
          disabled={activeSlideIdx === 0}
        >
          ← Previous
        </button>

        <div className={styles.slideCounter}>
          Slide {activeSlideIdx + 1} of {slides.length}
        </div>

        <button 
          className={styles.navBtn} 
          onClick={handleNextSlide}
          disabled={activeSlideIdx === slides.length - 1}
        >
          Next →
        </button>
      </div>

      {/* Slide Canvas */}
      <div 
        className={styles.slideCanvas}
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeIdx !== null && editingShape === null) {
            onShapeDelete(activeSlideIdx, selectedShapeIdx);
            setSelectedShapeIdx(null);
          }
        }}
      >
        <div className={styles.slide}>
          {/* Render shapes on slide */}
          {activeSlide.shapes.map((shape, shapeIdx) => (
            <div
              key={shapeIdx}
              className={styles.shapeContainer}
              style={{
                position: 'absolute',
                left: `${shape.x}px`,
                top: `${shape.y}px`,
                width: `${shape.width}px`,
                height: `${shape.height}px`,
                overflow: 'hidden',
                cursor: editingShape?.shape === shapeIdx ? 'text' : 'move',
                border: selectedShapeIdx === shapeIdx ? '1px dashed #666' : 'none',
              }}
              onClick={() => handleShapeClick(shapeIdx, shape.text)}
              onDoubleClick={() => handleShapeDoubleClick(shapeIdx, shape.text)}
              onPointerDown={(e) => handlePointerDown(e, shapeIdx, shape)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              {editingShape?.shape === shapeIdx ? (
                <textarea
                  className={styles.shapeTextarea}
                  value={editingShape.text}
                  onChange={(e) => setEditingShape({ ...editingShape, text: e.target.value })}
                  onBlur={handleTextSave}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  style={{
                    textAlign: shape.formatting.align || 'left',
                    background: shape.backgroundColor || 'transparent',
                    borderRadius: shape.type === 'ellipse' ? '50%' : (shape.type === 'round_rect' ? '12px' : '0'),
                    clipPath: shape.type === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : shape.type === 'right_arrow' ? 'polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)' : shape.type === 'hexagon' ? 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' : shape.type === 'star' ? 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' : 'none'
                  }}
                />
              ) : shape.type === 'image' && shape.imageUrl ? (
                <img
                  src={shape.imageUrl}
                  alt="Slide Image"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  draggable={false}
                />
              ) : (
                <div
                  className={styles.shapeText}
                  style={{
                    fontWeight: shape.formatting.bold ? 'bold' : 'normal',
                    fontStyle: shape.formatting.italic ? 'italic' : 'normal',
                    textDecoration: shape.formatting.underline ? 'underline' : 'none',
                    fontSize: shape.formatting.fontSize ? `${shape.formatting.fontSize}pt` : 'inherit',
                    fontFamily: shape.formatting.fontName || 'Calibri, sans-serif',
                    color: shape.formatting.color || '#111827',
                    padding: '8px',
                    wordWrap: 'break-word',
                    whiteSpace: 'pre-wrap',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: shape.formatting.align === 'center' ? 'center' : shape.formatting.align === 'right' ? 'flex-end' : 'flex-start',
                    textAlign: shape.formatting.align || 'left',
                    background: shape.backgroundColor || 'transparent',
                    border: shape.borderWidth && shape.type !== 'triangle' && shape.type !== 'right_arrow' && shape.type !== 'hexagon' && shape.type !== 'star' ? `${shape.borderWidth}px solid ${shape.borderColor || '#000'}` : 'none',
                    borderRadius: shape.type === 'ellipse' ? '50%' : (shape.type === 'round_rect' ? '12px' : '0'),
                    clipPath: shape.type === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : shape.type === 'right_arrow' ? 'polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)' : shape.type === 'hexagon' ? 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' : shape.type === 'star' ? 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' : 'none'
                  }}
                >
                  {shape.formatting.bullet && <span style={{ marginRight: '8px' }}>•</span>}
                  {shape.text}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Notes Panel below canvas */}
      {!isPresentMode && (
        <div style={{ padding: '0 2rem 1rem', background: '#1e1e1e', borderTop: '1px solid #444', display: 'flex', flexDirection: 'column' }}>
          <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '4px', marginTop: '8px' }}>Speaker Notes</div>
          <textarea
            style={{ width: '100%', height: '80px', background: '#2d2d2d', color: '#fff', border: '1px solid #555', padding: '8px', fontSize: '13px' }}
            value={activeSlide.notes || ''}
            onChange={(e) => onSlideNotesUpdate(activeSlideIdx, e.target.value)}
            placeholder="Click to add notes"
          />
        </div>
      )}

      {/* Slide Thumbnails Panel */}
      <div className={styles.thumbnailPanel}>
        <div className={styles.thumbnailLabel}>Slides</div>
        <div className={styles.thumbnails}>
          {slides.map((slide, idx) => (
            <div key={idx} style={{ position: 'relative', opacity: slide.isHidden ? 0.5 : 1 }}>
              <button
                className={`${styles.thumbnail} ${activeSlideIdx === idx ? styles.activeThumbnail : ''}`}
                onClick={() => {
                  setActiveSlideIdx(idx);
                  setEditingShape(null);
                }}
                title={`Slide ${slide.slideNumber}`}
              >
                <div className={styles.thumbnailContent}>
                  <span className={styles.slideNum}>{slide.slideNumber}</span>
                </div>
              </button>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '4px' }}>
                <button title="Move Up" onClick={() => onSlideMove(idx, 'up')} style={{ background: '#444', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '10px' }}>↑</button>
                <button title="Move Down" onClick={() => onSlideMove(idx, 'down')} style={{ background: '#444', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '10px' }}>↓</button>
                <button title="Hide/Unhide" onClick={() => onSlideToggleVisibility(idx)} style={{ background: '#444', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '10px' }}>👁</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Presentation Mode Overlay */}
      {isPresentMode && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#000', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none' }} tabIndex={-1} onKeyDown={(e) => {
          if (e.key === 'Escape') setIsPresentMode(false);
          if (e.key === 'ArrowRight' || e.key === 'Space') handleNextSlide();
          if (e.key === 'ArrowLeft') handlePrevSlide();
        }} ref={(el) => el?.focus()}>
          <div style={{ position: 'relative', width: '960px', height: '720px', background: '#fff', transform: 'scale(1.2)' }}>
            {activeSlide.shapes.map((shape, shapeIdx) => (
              <div key={shapeIdx} style={{
                position: 'absolute', left: `${shape.x}px`, top: `${shape.y}px`, width: `${shape.width}px`, height: `${shape.height}px`,
                background: shape.backgroundColor || 'transparent', border: shape.borderWidth && shape.type !== 'triangle' && shape.type !== 'right_arrow' && shape.type !== 'hexagon' && shape.type !== 'star' ? `${shape.borderWidth}px solid ${shape.borderColor || '#000'}` : 'none',
                borderRadius: shape.type === 'ellipse' ? '50%' : (shape.type === 'round_rect' ? '12px' : '0'), display: 'flex', alignItems: 'center',
                clipPath: shape.type === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : shape.type === 'right_arrow' ? 'polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)' : shape.type === 'hexagon' ? 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' : shape.type === 'star' ? 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' : 'none',
                justifyContent: shape.formatting.align === 'center' ? 'center' : shape.formatting.align === 'right' ? 'flex-end' : 'flex-start',
                padding: '8px', color: shape.formatting.color || '#000',
                fontWeight: shape.formatting.bold ? 'bold' : 'normal', fontStyle: shape.formatting.italic ? 'italic' : 'normal',
                textDecoration: shape.formatting.underline ? 'underline' : 'none', fontSize: shape.formatting.fontSize ? `${shape.formatting.fontSize}pt` : 'inherit',
                fontFamily: shape.formatting.fontName || 'Calibri, sans-serif'
              }}>
                {shape.type === 'image' && shape.imageUrl ? (
                  <img src={shape.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <>
                    {shape.formatting.bullet && <span style={{ marginRight: '8px' }}>•</span>}
                    {shape.text}
                  </>
                )}
              </div>
            ))}
          </div>
          <div style={{ position: 'absolute', bottom: '20px', right: '20px', background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius: '8px', color: 'white', display: 'flex', gap: '10px' }}>
            <button onClick={handlePrevSlide} style={{ cursor: 'pointer', background: 'none', border: 'none', color: 'white', fontSize: '20px' }}>◀</button>
            <button onClick={handleNextSlide} style={{ cursor: 'pointer', background: 'none', border: 'none', color: 'white', fontSize: '20px' }}>▶</button>
            <button onClick={() => setIsPresentMode(false)} style={{ cursor: 'pointer', background: 'none', border: 'none', color: 'white', fontSize: '20px', marginLeft: '10px' }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
});

export default SlideNavigator;
