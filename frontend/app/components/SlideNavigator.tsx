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
  onSlideDuplicate: (slideIdx: number) => void;
  onSlideDelete: (slideIdx: number) => void;
  onSlideReplace: (slideIdx: number, slide: PresentationSlide) => void;
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
  { slides, onTextChange, onShapeFormatChange, onSlideAdd, onSlideDuplicate, onSlideDelete, onSlideReplace, onShapeAdd, onShapeDelete, onSlideMove, onSlideToggleVisibility, onSlideNotesUpdate, onAITranslate }: SlideNavigatorProps,
  ref
) {
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [editingShape, setEditingShape] = useState<{ shape: number; text: string } | null>(null);
  const [selectedShapeIdx, setSelectedShapeIdx] = useState<number | null>(null);
  const [selectedShapeIdxs, setSelectedShapeIdxs] = useState<number[]>([]);
  const [dragState, setDragState] = useState<{ shapeIdx: number; startX: number; startY: number; initX: number; initY: number } | null>(null);
  const [isPresentMode, setIsPresentMode] = useState(false);

  const activeSlide = slides[activeSlideIdx];
  const slideWidth = 960;
  const slideHeight = 720;

  const handleShapeClick = (shapeIdx: number, e: React.MouseEvent) => {
    if (e.shiftKey) {
      setSelectedShapeIdxs((prev) => {
        if (prev.includes(shapeIdx)) {
          const next = prev.filter((idx) => idx !== shapeIdx);
          setSelectedShapeIdx(next.length ? next[next.length - 1] : null);
          return next;
        }
        const next = [...prev, shapeIdx];
        setSelectedShapeIdx(shapeIdx);
        return next;
      });
      return;
    }

    setSelectedShapeIdx(shapeIdx);
    setSelectedShapeIdxs([shapeIdx]);
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
        setSelectedShapeIdxs([]);
        return;
      }

      if (action.type === 'prevSlide') {
        setActiveSlideIdx((prev) => Math.max(0, prev - 1));
        setSelectedShapeIdx(null);
        setSelectedShapeIdxs([]);
        return;
      }

      if (action.type === 'addSlide') {
        onSlideAdd(activeSlideIdx);
        setActiveSlideIdx(activeSlideIdx + 1);
        setSelectedShapeIdx(null);
        setSelectedShapeIdxs([]);
        return;
      }

      if (action.type === 'applySlideLayout') {
        const buildLayoutShapes = (): SlideShape[] => {
          if (action.layout === 'blank') return [];

          if (action.layout === 'title') {
            return [
              {
                type: 'text',
                text: '제목을 입력하세요',
                x: 120,
                y: 140,
                width: 720,
                height: 100,
                formatting: { bold: true, italic: false, underline: false, fontSize: 44, fontName: 'Calibri', color: '#111827', align: 'center' },
              },
              {
                type: 'text',
                text: '부제목을 입력하세요',
                x: 180,
                y: 280,
                width: 600,
                height: 70,
                formatting: { bold: false, italic: false, underline: false, fontSize: 24, fontName: 'Calibri', color: '#334155', align: 'center' },
              },
            ];
          }

          if (action.layout === 'titleContent') {
            return [
              {
                type: 'text',
                text: '슬라이드 제목',
                x: 70,
                y: 40,
                width: 820,
                height: 70,
                formatting: { bold: true, italic: false, underline: false, fontSize: 36, fontName: 'Calibri', color: '#111827', align: 'left' },
              },
              {
                type: 'round_rect',
                text: '핵심 내용을 입력하세요',
                x: 70,
                y: 140,
                width: 820,
                height: 500,
                formatting: { bold: false, italic: false, underline: false, fontSize: 22, fontName: 'Calibri', color: '#111827', align: 'left', bullet: true },
                backgroundColor: '#f8fafc',
                borderColor: '#cbd5e1',
                borderWidth: 2,
              },
            ];
          }

          if (action.layout === 'twoContent') {
            return [
              {
                type: 'text',
                text: '비교/병렬 설명 제목',
                x: 70,
                y: 40,
                width: 820,
                height: 70,
                formatting: { bold: true, italic: false, underline: false, fontSize: 34, fontName: 'Calibri', color: '#111827', align: 'left' },
              },
              {
                type: 'round_rect',
                text: '왼쪽 내용',
                x: 70,
                y: 140,
                width: 390,
                height: 500,
                formatting: { bold: false, italic: false, underline: false, fontSize: 20, fontName: 'Calibri', color: '#0f172a', align: 'left', bullet: true },
                backgroundColor: '#f8fafc',
                borderColor: '#cbd5e1',
                borderWidth: 2,
              },
              {
                type: 'round_rect',
                text: '오른쪽 내용',
                x: 500,
                y: 140,
                width: 390,
                height: 500,
                formatting: { bold: false, italic: false, underline: false, fontSize: 20, fontName: 'Calibri', color: '#0f172a', align: 'left', bullet: true },
                backgroundColor: '#f8fafc',
                borderColor: '#cbd5e1',
                borderWidth: 2,
              },
            ];
          }

          return [
            {
              type: 'text',
              text: '섹션 제목',
              x: 120,
              y: 220,
              width: 720,
              height: 120,
              formatting: { bold: true, italic: false, underline: false, fontSize: 52, fontName: 'Calibri', color: '#111827', align: 'center' },
            },
          ];
        };

        const updatedSlide: PresentationSlide = {
          ...slides[activeSlideIdx],
          shapes: buildLayoutShapes(),
        };
        onSlideReplace(activeSlideIdx, updatedSlide);
        setSelectedShapeIdx(null);
        setSelectedShapeIdxs([]);
        setEditingShape(null);
        return;
      }

      if (action.type === 'duplicateSlide') {
        onSlideDuplicate(activeSlideIdx);
        setActiveSlideIdx(Math.min(slides.length, activeSlideIdx + 1));
        setSelectedShapeIdx(null);
        setSelectedShapeIdxs([]);
        return;
      }

      if (action.type === 'deleteSlide') {
        onSlideDelete(activeSlideIdx);
        setActiveSlideIdx(Math.max(0, activeSlideIdx - 1));
        setSelectedShapeIdx(null);
        setSelectedShapeIdxs([]);
        return;
      }

      if (action.type === 'moveSlideUp') {
        if (activeSlideIdx > 0) {
          onSlideMove(activeSlideIdx, 'up');
          setActiveSlideIdx(activeSlideIdx - 1);
          setSelectedShapeIdx(null);
          setSelectedShapeIdxs([]);
        }
        return;
      }

      if (action.type === 'moveSlideDown') {
        if (activeSlideIdx < slides.length - 1) {
          onSlideMove(activeSlideIdx, 'down');
          setActiveSlideIdx(activeSlideIdx + 1);
          setSelectedShapeIdx(null);
          setSelectedShapeIdxs([]);
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
          setSelectedShapeIdxs([]);
        }
        return;
      }

      const targetIndexes = selectedShapeIdxs.length > 1
        ? selectedShapeIdxs
        : selectedShapeIdx !== null
          ? [selectedShapeIdx]
          : [];

      const getSelectionBounds = (indexes: number[]) => {
        const shapes = indexes
          .map((idx) => slides[activeSlideIdx].shapes[idx])
          .filter(Boolean);

        if (!shapes.length) return null;

        const left = Math.min(...shapes.map((s) => s.x));
        const top = Math.min(...shapes.map((s) => s.y));
        const right = Math.max(...shapes.map((s) => s.x + s.width));
        const bottom = Math.max(...shapes.map((s) => s.y + s.height));
        return {
          left,
          top,
          right,
          bottom,
          centerX: (left + right) / 2,
          centerY: (top + bottom) / 2,
        };
      };

      if (action.type === 'alignInSelection') {
        if (targetIndexes.length < 2) return;
        const bounds = getSelectionBounds(targetIndexes);
        if (!bounds) return;

        const updatedShapes = [...slides[activeSlideIdx].shapes];
        targetIndexes.forEach((idx) => {
          const shape = updatedShapes[idx];
          if (!shape) return;

          if (action.value === 'left') shape.x = bounds.left;
          if (action.value === 'center') shape.x = Math.round(bounds.centerX - shape.width / 2);
          if (action.value === 'right') shape.x = Math.round(bounds.right - shape.width);
          if (action.value === 'top') shape.y = bounds.top;
          if (action.value === 'middle') shape.y = Math.round(bounds.centerY - shape.height / 2);
          if (action.value === 'bottom') shape.y = Math.round(bounds.bottom - shape.height);

          shape.x = Math.max(0, Math.min(slideWidth - shape.width, shape.x));
          shape.y = Math.max(0, Math.min(slideHeight - shape.height, shape.y));
        });

        onSlideReplace(activeSlideIdx, { ...slides[activeSlideIdx], shapes: updatedShapes });
        return;
      }

      if (action.type === 'distributeShapes') {
        const indices = targetIndexes.length >= 2
          ? [...targetIndexes]
          : slides[activeSlideIdx].shapes.map((_, idx) => idx);

        if (indices.length < 2) return;

        const sorted = [...indices].sort((a, b) => {
          const shapeA = slides[activeSlideIdx].shapes[a];
          const shapeB = slides[activeSlideIdx].shapes[b];
          if (action.direction === 'horizontal') return shapeA.x - shapeB.x;
          return shapeA.y - shapeB.y;
        });

        const updatedShapes = slides[activeSlideIdx].shapes.map((shape) => ({ ...shape, formatting: { ...shape.formatting } }));
        const first = updatedShapes[sorted[0]];
        const last = updatedShapes[sorted[sorted.length - 1]];
        if (!first || !last) return;

        if (action.direction === 'horizontal') {
          const start = first.x;
          const end = last.x + last.width;
          const totalWidth = sorted.reduce((sum, idx) => sum + updatedShapes[idx].width, 0);
          const gap = sorted.length > 1 ? (end - start - totalWidth) / (sorted.length - 1) : 0;

          let cursor = start;
          sorted.forEach((shapeIdx) => {
            updatedShapes[shapeIdx].x = Math.max(0, Math.min(slideWidth - updatedShapes[shapeIdx].width, Math.round(cursor)));
            cursor += updatedShapes[shapeIdx].width + gap;
          });
        } else {
          const start = first.y;
          const end = last.y + last.height;
          const totalHeight = sorted.reduce((sum, idx) => sum + updatedShapes[idx].height, 0);
          const gap = sorted.length > 1 ? (end - start - totalHeight) / (sorted.length - 1) : 0;

          let cursor = start;
          sorted.forEach((shapeIdx) => {
            updatedShapes[shapeIdx].y = Math.max(0, Math.min(slideHeight - updatedShapes[shapeIdx].height, Math.round(cursor)));
            cursor += updatedShapes[shapeIdx].height + gap;
          });
        }

        onSlideReplace(activeSlideIdx, { ...slides[activeSlideIdx], shapes: updatedShapes });
        return;
      }

      if (targetIndexes.length === 0) {
        return;
      }

      const currentShape = slides[activeSlideIdx]?.shapes?.[targetIndexes[0]];
      if (!currentShape) return;

      if (action.type === 'replaceSelectedImage') {
        const updatedShapes = [...slides[activeSlideIdx].shapes];
        let replaced = false;
        targetIndexes.forEach((idx) => {
          const shape = updatedShapes[idx];
          if (!shape || shape.type !== 'image') return;
          updatedShapes[idx] = {
            ...shape,
            imageUrl: action.value,
          };
          replaced = true;
        });

        if (replaced) {
          onSlideReplace(activeSlideIdx, { ...slides[activeSlideIdx], shapes: updatedShapes });
        }
        return;
      }

      if (action.type === 'duplicateShape') {
        const clonedShapes = targetIndexes
          .map((idx) => slides[activeSlideIdx].shapes[idx])
          .filter(Boolean)
          .map((shape) => ({
            ...shape,
            x: shape.x + 20,
            y: shape.y + 20,
            formatting: { ...shape.formatting },
          }));
        const updatedSlide: PresentationSlide = {
          ...slides[activeSlideIdx],
          shapes: [...slides[activeSlideIdx].shapes, ...clonedShapes],
        };
        onSlideReplace(activeSlideIdx, updatedSlide);
        const firstNewIdx = slides[activeSlideIdx].shapes.length;
        const nextSelection = clonedShapes.map((_, i) => firstNewIdx + i);
        setSelectedShapeIdx(nextSelection[0] ?? null);
        setSelectedShapeIdxs(nextSelection);
        return;
      }

      if (action.type === 'bringToFront' || action.type === 'sendToBack') {
        const shapes = [...slides[activeSlideIdx].shapes];
        const selectedSet = new Set(targetIndexes);
        const picked = shapes.filter((_, idx) => selectedSet.has(idx));
        const rest = shapes.filter((_, idx) => !selectedSet.has(idx));
        if (!picked.length) return;
        if (action.type === 'bringToFront') {
          const next = [...rest, ...picked];
          onSlideReplace(activeSlideIdx, { ...slides[activeSlideIdx], shapes: next });
          const start = next.length - picked.length;
          const indexes = picked.map((_, i) => start + i);
          setSelectedShapeIdx(indexes[0] ?? null);
          setSelectedShapeIdxs(indexes);
        } else {
          const next = [...picked, ...rest];
          onSlideReplace(activeSlideIdx, { ...slides[activeSlideIdx], shapes: next });
          const indexes = picked.map((_, i) => i);
          setSelectedShapeIdx(indexes[0] ?? null);
          setSelectedShapeIdxs(indexes);
        }
        return;
      }

      const updatedShapes = [...slides[activeSlideIdx].shapes];
      targetIndexes.forEach((idx) => {
        const shape = updatedShapes[idx];
        if (!shape) return;
        const nextShape: SlideShape = {
          ...shape,
          formatting: { ...shape.formatting },
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

        if (action.type === 'alignOnSlide') {
          if (action.value === 'left') nextShape.x = 0;
          if (action.value === 'center') nextShape.x = Math.max(0, (slideWidth - nextShape.width) / 2);
          if (action.value === 'right') nextShape.x = Math.max(0, slideWidth - nextShape.width);
          if (action.value === 'top') nextShape.y = 0;
          if (action.value === 'middle') nextShape.y = Math.max(0, (slideHeight - nextShape.height) / 2);
          if (action.value === 'bottom') nextShape.y = Math.max(0, slideHeight - nextShape.height);
        }

        if (action.type === 'bullet') {
          nextShape.formatting.bullet = !nextShape.formatting.bullet;
        }

        if (action.type === 'setShapeFillColor') {
          nextShape.backgroundColor = action.value;
        }

        if (action.type === 'setShapeBorderColor') {
          nextShape.borderColor = action.value;
        }

        if (action.type === 'setShapeBorderWidth') {
          nextShape.borderWidth = Math.max(0, action.value);
        }

        if (action.type === 'setImageFit') {
          if (nextShape.type === 'image') {
            nextShape.imageFit = action.value;
          }
        }

        if (action.type === 'nudgeShape') {
          nextShape.x = Math.max(0, Math.min(slideWidth - nextShape.width, nextShape.x + action.dx));
          nextShape.y = Math.max(0, Math.min(slideHeight - nextShape.height, nextShape.y + action.dy));
        }

        updatedShapes[idx] = nextShape;
      });

      onSlideReplace(activeSlideIdx, { ...slides[activeSlideIdx], shapes: updatedShapes });
    },
  }), [slides, activeSlideIdx, selectedShapeIdx, selectedShapeIdxs, isPresentMode, onSlideAdd, onSlideDelete, onSlideDuplicate, onSlideMove, onSlideToggleVisibility, onSlideNotesUpdate, onShapeAdd, onShapeDelete, onShapeFormatChange, onSlideReplace, onAITranslate]);

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
            setSelectedShapeIdxs([]);
          }

          if (selectedShapeIdx !== null && editingShape === null) {
            const shape = activeSlide.shapes[selectedShapeIdx];
            if (!shape) return;
            const step = e.shiftKey ? 10 : 1;
            let dx = 0;
            let dy = 0;
            if (e.key === 'ArrowLeft') dx = -step;
            if (e.key === 'ArrowRight') dx = step;
            if (e.key === 'ArrowUp') dy = -step;
            if (e.key === 'ArrowDown') dy = step;
            if (dx !== 0 || dy !== 0) {
              e.preventDefault();
              onShapeFormatChange(activeSlideIdx, selectedShapeIdx, {
                ...shape,
                x: Math.max(0, Math.min(slideWidth - shape.width, shape.x + dx)),
                y: Math.max(0, Math.min(slideHeight - shape.height, shape.y + dy)),
              });
            }
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
                border: selectedShapeIdxs.includes(shapeIdx) ? '2px dashed #0ea5e9' : selectedShapeIdx === shapeIdx ? '1px dashed #666' : 'none',
              }}
              onClick={(e) => handleShapeClick(shapeIdx, e)}
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
                  style={{ width: '100%', height: '100%', objectFit: shape.imageFit || 'cover' }}
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
                  setSelectedShapeIdx(null);
                  setSelectedShapeIdxs([]);
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
                  <img src={shape.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: shape.imageFit || 'cover' }} />
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
