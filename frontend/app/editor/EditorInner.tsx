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

export default function EditorInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileName = searchParams.get('file') ?? '';

  const [docModel, setDocModel] = useState<DocumentModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');

  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const textCanvasRef = useRef<DocumentCanvasHandle>(null);
  const spreadsheetRef = useRef<SpreadsheetGridHandle>(null);
  const slideRef = useRef<SlideNavigatorHandle>(null);

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
        if (!downloadRes.ok) throw new Error('Failed to download file');
        const fileBlob = await downloadRes.blob();

        const formData = new FormData();
        formData.append('file', fileBlob, fileName);

        const parseRes = await fetch('/api/documents/parse', {
          method: 'POST',
          headers: { Authorization: `Bearer ${user.token}` },
          body: formData,
        });
        if (!parseRes.ok) throw new Error('Failed to parse document');
        const parsed = (await parseRes.json()) as DocumentModel;

        setDocModel(parsed);
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
      setDocModel(updatedModel);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        autoSaveDocument(updatedModel);
      }, 2500);
    },
    [autoSaveDocument]
  );

  const handleCellChange = useCallback(
    (sheetIdx: number, rowIdx: number, cellIdx: number, updatedCell: SpreadsheetCell) => {
      setDocModel((prev) => {
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

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          autoSaveDocument(updatedModel);
        }, 2500);

        return updatedModel;
      });
    },
    [autoSaveDocument]
  );

  const handleSheetReplace = useCallback(
    (sheetIdx: number, sheet: SpreadsheetSheet) => {
      setDocModel((prev) => {
        if (!prev || !isSpreadsheetDocument(prev)) return prev;

        const updatedSheets = prev.sheets.map((item, idx) => (idx === sheetIdx ? sheet : item));
        const updatedModel: DocumentModel = {
          ...prev,
          sheets: updatedSheets,
        };

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          autoSaveDocument(updatedModel);
        }, 2500);

        return updatedModel;
      });
    },
    [autoSaveDocument]
  );

  const handleSlideTextChange = useCallback(
    (slideIdx: number, shapeIdx: number, newText: string) => {
      setDocModel((prev) => {
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

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          autoSaveDocument(updatedModel);
        }, 2500);

        return updatedModel;
      });
    },
    [autoSaveDocument]
  );

  const handleSlideShapeFormatChange = useCallback(
    (slideIdx: number, shapeIdx: number, shapeUpdate: PresentationSlide['shapes'][number]) => {
      setDocModel((prev) => {
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

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          autoSaveDocument(updatedModel);
        }, 2500);

        return updatedModel;
      });
    },
    [autoSaveDocument]
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

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

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
