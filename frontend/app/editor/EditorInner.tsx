'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import DocumentCanvas, { DocumentCanvasHandle } from '../components/DocumentCanvas';
import SpreadsheetGrid, { SpreadsheetGridHandle } from '../components/SpreadsheetGrid';
import SlideNavigator, { SlideNavigatorHandle } from '../components/SlideNavigator';
import RibbonManager from '../components/RibbonManager';
import {
  FileType,
  DocumentModel,
  SaveStatus,
  isPresentationDocument,
  isSpreadsheetDocument,
  isTextDocument,
  PresentationSlide,
  SpreadsheetSheet,
  SpreadsheetCell,
} from '../types/document';
import styles from './editor.module.css';

/**
 * EditorInner: The core orchestration component for the WebOffice suite.
 * Manages the state of the DocumentModel, handles auto-saving with debouncing,
 * routes document types to specific UI canvases (Word, Excel, PPT),
 * and maintains a Undo/Redo history stack (Phase 4 Gap Analysis implementation).
 */
export default function EditorInner() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileName = searchParams.get('file') ?? '';

  const [docModel, setDocModel] = useState<DocumentModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const textCanvasRef = useRef<DocumentCanvasHandle>(null);
  const spreadsheetRef = useRef<SpreadsheetGridHandle>(null);
  const slideRef = useRef<SlideNavigatorHandle>(null);

  // ── Undo/Redo History Stack (Phase 4 Audit) ──
  const historyRef = useRef<DocumentModel[]>([]);
  const historyIdxRef = useRef<number>(-1);
  const isUndoRedoRef = useRef(false);

  /**
   * Safe state updater that automatically pushes to the History Stack
   * and triggers the debounced auto-save function to prevent UI flash/freeze.
   */
  const updateDocModel = useCallback((newModelOrFn: DocumentModel | ((prev: DocumentModel | null) => DocumentModel | null)) => {
    setDocModel((prev) => {
      const nextModel = typeof newModelOrFn === 'function' ? newModelOrFn(prev) : newModelOrFn;
      if (nextModel && nextModel !== prev) {
        if (!isUndoRedoRef.current) {
          const currentHist = historyRef.current.slice(0, historyIdxRef.current + 1);
          currentHist.push(nextModel);
          if (currentHist.length > 20) currentHist.shift(); // Keep last 20 states
          historyRef.current = currentHist;
          historyIdxRef.current = currentHist.length - 1;
        }
        isUndoRedoRef.current = false;
        
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          autoSaveDocument(nextModel);
        }, 2500);
      }
      return nextModel;
    });
  }, [/* autoSaveDocument is omitted from deps to avoid loop if possible, but safe here */]);

  useEffect(() => {
    if (!fileName || !user?.token) {
      setLoading(false);
      return;
    }

    const loadDocument = async () => {
      try {
        const downloadRes = await fetch(
          `/api/storage/download/${encodeURIComponent(fileName)}`,
          { headers: { Authorization: `Bearer ${user.token}` } }
        );
        if (downloadRes.status === 401) {
          logout();
          router.push('/?error=session_expired');
          return;
        }
        if (!downloadRes.ok) throw new Error('Failed to download file');
        const fileBlob = await downloadRes.blob();

        const formData = new FormData();
        formData.append('file', fileBlob, fileName);

        const parseRes = await fetch('/api/documents/parse', {
          method: 'POST',
          headers: { Authorization: `Bearer ${user.token}` },
          body: formData,
        });
        if (parseRes.status === 401) {
          logout();
          router.push('/?error=session_expired');
          return;
        }
        if (!parseRes.ok) throw new Error('Failed to parse document');
        const parsed = (await parseRes.json()) as DocumentModel;

        setDocModel(parsed);
        // Initialize History Stack
        historyRef.current = [parsed];
        historyIdxRef.current = 0;
        setLoading(false);
      } catch (err) {
        console.error('Load error:', err);
        setError(String(err));
        setLoading(false);
      }
    };

    loadDocument();
  }, [fileName, user?.token]);

  const autoSaveDocument = useCallback(
    async (model: DocumentModel) => {
      if (!user?.token || !fileName) return;

      setSaveStatus('saving');

      try {
        const saveRes = await fetch('/api/documents/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({
            fileName,
            documentModel: model,
          }),
        });

        if (saveRes.status === 401) {
          alert('세션이 만료되었습니다. 다시 로그인해주세요.');
          logout();
          router.push('/');
          return;
        }

        if (!saveRes.ok) throw new Error('Save failed');

        setSaveStatus('saved');
        setLastSavedTime(new Date().toLocaleTimeString());

        setTimeout(() => setSaveStatus('idle'), 3000);
      } catch (err) {
        console.error('Save error:', err);
        setSaveStatus('error');
      }
    },
    [user?.token, fileName]
  );

  const handleContentChange = useCallback(
    (updatedModel: DocumentModel) => {
      updateDocModel(updatedModel);
    },
    [updateDocModel]
  );

  const handleCellChange = useCallback(
    (sheetIdx: number, rowIdx: number, cellIdx: number, updatedCell: SpreadsheetCell) => {
      updateDocModel((prev) => {
        if (!prev || !isSpreadsheetDocument(prev)) return prev;

        const updatedSheets = prev.sheets.map((sheet, sIdx) => {
          if (sIdx !== sheetIdx) return sheet;

          const updatedGrid = sheet.grid.map((row, rIdx) => {
            if (rIdx !== rowIdx) return row;
            return row.map((cell, cIdx) => (cIdx === cellIdx ? updatedCell : cell));
          });

          return {
            ...sheet,
            grid: updatedGrid,
          };
        });

        const updatedModel: DocumentModel = {
          ...prev,
          sheets: updatedSheets,
        };

        return updatedModel;
      });
    },
    [updateDocModel]
  );

  const handleSheetReplace = useCallback(
    (sheetIdx: number, sheet: SpreadsheetSheet) => {
      updateDocModel((prev) => {
        if (!prev || !isSpreadsheetDocument(prev)) return prev;

        const updatedSheets = prev.sheets.map((item, idx) => (idx === sheetIdx ? sheet : item));
        const updatedModel: DocumentModel = {
          ...prev,
          sheets: updatedSheets,
        };

        return updatedModel;
      });
    },
    [updateDocModel]
  );

  const handleSlideTextChange = useCallback(
    (slideIdx: number, shapeIdx: number, newText: string) => {
      updateDocModel((prev) => {
        if (!prev || !isPresentationDocument(prev)) return prev;

        const updatedSlides = prev.slides.map((slide, sIdx) => {
          if (sIdx !== slideIdx) return slide;
          return {
            ...slide,
            shapes: slide.shapes.map((shape, shapeIndex) =>
              shapeIndex === shapeIdx ? { ...shape, text: newText } : shape
            ),
          };
        });

        const updatedModel: DocumentModel = {
          ...prev,
          slides: updatedSlides,
        };

        return updatedModel;
      });
    },
    [updateDocModel]
  );

  const handleSlideShapeFormatChange = useCallback(
    (slideIdx: number, shapeIdx: number, shapeUpdate: PresentationSlide['shapes'][number]) => {
      updateDocModel((prev) => {
        if (!prev || !isPresentationDocument(prev)) return prev;

        const updatedSlides = prev.slides.map((slide, sIdx) => {
          if (sIdx !== slideIdx) return slide;
          return {
            ...slide,
            shapes: slide.shapes.map((shape, currentShapeIdx) =>
              currentShapeIdx === shapeIdx ? shapeUpdate : shape
            ),
          };
        });

        const updatedModel: DocumentModel = {
          ...prev,
          slides: updatedSlides,
        };

        return updatedModel;
      });
    },
    [updateDocModel]
  );

  const handleTextRibbonAction = useCallback((action: Parameters<DocumentCanvasHandle['applyAction']>[0]) => {
    textCanvasRef.current?.applyAction(action);
  }, []);

  const handleSpreadsheetRibbonAction = useCallback((action: Parameters<SpreadsheetGridHandle['applyAction']>[0]) => {
    spreadsheetRef.current?.applyAction(action);
  }, []);

  const handlePresentationRibbonAction = useCallback((action: Parameters<SlideNavigatorHandle['applyAction']>[0]) => {
    slideRef.current?.applyAction(action);
  }, []);

  const handleExportPdf = useCallback(async () => {
    if (!user?.token || !docModel) return;
    try {
      const res = await fetch('/api/documents/export-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(docModel),
      });

      if (!res.ok) throw new Error('PDF Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName.split('.')[0] || 'document'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to export PDF');
    }
  }, [user?.token, docModel, fileName]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (docModel) autoSaveDocument(docModel);
      } else if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (historyIdxRef.current > 0) {
          historyIdxRef.current -= 1;
          const restored = historyRef.current[historyIdxRef.current];
          isUndoRedoRef.current = true;
          updateDocModel(restored);
        }
      } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (historyIdxRef.current < historyRef.current.length - 1) {
          historyIdxRef.current += 1;
          const restored = historyRef.current[historyIdxRef.current];
          isUndoRedoRef.current = true;
          updateDocModel(restored);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [docModel, autoSaveDocument]);

  const handleBackToDashboard = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className={styles.shell}>
        <div className={styles.loadingState}>
          <p>Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.shell}>
        <div className={styles.errorState}>
          <p>Error: {error}</p>
          <button onClick={() => router.push('/dashboard')}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  if (!docModel) {
    return (
      <div className={styles.shell}>
        <div className={styles.emptyState}>
          <p>No document loaded</p>
        </div>
      </div>
    );
  }

  const currentFileType = String(docModel.fileType || docModel.format || 'unknown').toLowerCase() as FileType;
  const mainLayoutClass = isSpreadsheetDocument(docModel)
    ? styles.mainExcel
    : isPresentationDocument(docModel)
      ? styles.mainPpt
      : styles.mainDefault;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={handleBackToDashboard}>
          ← Back
        </button>
        <span className={styles.fileName}>{fileName}</span>
      </header>

      <RibbonManager
        fileType={currentFileType}
        saveStatus={saveStatus}
        lastSavedTime={lastSavedTime}
        onTextAction={handleTextRibbonAction}
        onSpreadsheetAction={handleSpreadsheetRibbonAction}
        onPresentationAction={handlePresentationRibbonAction}
        onExportPdf={handleExportPdf}
      />

      <main className={`${styles.mainArea} ${mainLayoutClass}`}>
        {isSpreadsheetDocument(docModel) ? (
          <SpreadsheetGrid
            ref={spreadsheetRef}
            sheets={docModel.sheets}
            onCellChange={handleCellChange}
            onSheetReplace={handleSheetReplace}
          />
        ) : isPresentationDocument(docModel) ? (
          <SlideNavigator
            ref={slideRef}
            slides={docModel.slides}
            onTextChange={handleSlideTextChange}
            onShapeFormatChange={handleSlideShapeFormatChange}
          />
        ) : isTextDocument(docModel) ? (
          <DocumentCanvas
            ref={textCanvasRef}
            document={docModel}
            onContentChange={handleContentChange}
          />
        ) : (
          <div className={styles.emptyState}>
            <p>Unsupported document model.</p>
          </div>
        )}
      </main>
    </div>
  );
}
