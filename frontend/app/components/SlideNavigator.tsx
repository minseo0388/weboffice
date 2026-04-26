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
}

export interface SlideNavigatorHandle {
  applyAction: (action: PresentationToolAction) => void;
}

/**
 * SlideNavigator: Renders PowerPoint slides with editable text shapes.
 * Supports slide-by-slide navigation and text editing within shapes.
 */
const SlideNavigator = forwardRef<SlideNavigatorHandle, SlideNavigatorProps>(function SlideNavigator(
  { slides, onTextChange, onShapeFormatChange }: SlideNavigatorProps,
  ref
) {
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [editingShape, setEditingShape] = useState<{ shape: number; text: string } | null>(null);
  const [selectedShapeIdx, setSelectedShapeIdx] = useState<number | null>(null);
  const [dragState, setDragState] = useState<{ shapeIdx: number; startX: number; startY: number; initX: number; initY: number } | null>(null);

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
      <div className={styles.slideCanvas}>
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
                    padding: '4px 8px',
                    wordWrap: 'break-word',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {shape.text}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Slide Thumbnails Panel */}
      <div className={styles.thumbnailPanel}>
        <div className={styles.thumbnailLabel}>Slides</div>
        <div className={styles.thumbnails}>
          {slides.map((slide, idx) => (
            <button
              key={idx}
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
          ))}
        </div>
      </div>
    </div>
  );
});

export default SlideNavigator;
