'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import DocumentCanvas, { DocumentCanvasHandle } from '../components/DocumentCanvas';
import SpreadsheetGrid, { SpreadsheetGridHandle } from '../components/SpreadsheetGrid';
import SlideNavigator, { SlideNavigatorHandle } from '../components/SlideNavigator';
import ExcelRibbon from '../components/ribbon/ExcelRibbon';
import WordRibbon from '../components/ribbon/WordRibbon';
import HanwordRibbon from '../components/ribbon/HanwordRibbon';
import PowerPointRibbon from '../components/ribbon/PowerPointRibbon';
import HwpInspectorPanel from '../components/HwpInspectorPanel';
import LibraryApiPanel from '../components/LibraryApiPanel';
import { ExportOption } from '../components/ribbon/ExportMenu';
import {
  FileType,
  DocumentModel,
  SaveStatus,
  DEFAULT_PAGE_SETTINGS,
  PageSettings,
  isPresentationDocument,
  isSpreadsheetDocument,
  isTextDocument,
  PresentationSlide,
  SlideShape,
  SpreadsheetSheet,
  SpreadsheetCell,
  HwpDocumentModel,
} from '../types/document';
import styles from './editor.module.css';

// ── Export option presets per file type ──────────────────────────────────────
const TEXT_EXPORT_OPTIONS: ExportOption[] = [
  { format: 'pdf',  label: 'PDF 문서',     icon: '📄' },
  { format: 'docx', label: 'Word (.docx)', icon: '📝' },
  { format: 'hwpx', label: '한글 (.hwpx)', icon: '🇰🇷' },
  { format: 'txt',  label: '텍스트',       icon: '📃' },
  { format: 'html', label: 'HTML 페이지',  icon: '🌐' },
];
// HWPX 편집 파일 — 저장 후 HWPX 다운로드 + 변환 내보내기
const HWPX_EXPORT_OPTIONS: ExportOption[] = [
  { format: 'hwpx', label: '한글 (.hwpx)',  icon: '🇰🇷' },
  { format: 'pdf',  label: 'PDF 문서',      icon: '📄' },
  { format: 'docx', label: 'Word (.docx)',  icon: '📝' },
  { format: 'txt',  label: '텍스트',        icon: '📃' },
];
// HWP 뷰어 전용 — 편집 불가, 변환 내보내기만 지원
const HWP_EXPORT_OPTIONS: ExportOption[] = [
  { format: 'pdf',  label: 'PDF로 내보내기',    icon: '📄' },
  { format: 'docx', label: 'Word로 내보내기',   icon: '📝' },
  { format: 'hwpx', label: 'HWPX로 내보내기',  icon: '🇰🇷' },
];
const EXCEL_EXPORT_OPTIONS: ExportOption[] = [
  { format: 'pdf',  label: 'PDF 문서',       icon: '📄' },
  { format: 'xlsx', label: 'Excel (.xlsx)', icon: '📊' },
  { format: 'csv',  label: 'CSV',           icon: '📋' },
  { format: 'html', label: 'HTML 페이지',   icon: '🌐' },
];
const PPT_EXPORT_OPTIONS: ExportOption[] = [
  { format: 'pdf',  label: 'PDF 문서',            icon: '📄' },
  { format: 'pptx', label: 'PowerPoint (.pptx)', icon: '📊' },
  { format: 'html', label: 'HTML 프레젠테이션',   icon: '🌐' },
];

function pageSetupToPageSettings(pageSetup?: Record<string, number>): PageSettings {
  return {
    ...DEFAULT_PAGE_SETTINGS,
    widthMm: pageSetup?.paperWidth,
    heightMm: pageSetup?.paperHeight,
    margins: {
      ...DEFAULT_PAGE_SETTINGS.margins,
      top: pageSetup?.topMargin ?? DEFAULT_PAGE_SETTINGS.margins.top,
      bottom: pageSetup?.bottomMargin ?? DEFAULT_PAGE_SETTINGS.margins.bottom,
      left: pageSetup?.leftMargin ?? DEFAULT_PAGE_SETTINGS.margins.left,
      right: pageSetup?.rightMargin ?? DEFAULT_PAGE_SETTINGS.margins.right,
      header: pageSetup?.headerMargin ?? DEFAULT_PAGE_SETTINGS.margins.header,
      footer: pageSetup?.footerMargin ?? DEFAULT_PAGE_SETTINGS.margins.footer,
      gutter: pageSetup?.gutterMargin ?? DEFAULT_PAGE_SETTINGS.margins.gutter,
    },
  };
}

function normalizeHwpDocumentModel(model: HwpDocumentModel): HwpDocumentModel {
  if (model.pageSettings) return model;
  const pageSetup = model.sections?.[0]?.pageSetup;
  if (!pageSetup) return model;
  return {
    ...model,
    pageSettings: pageSetupToPageSettings(pageSetup),
  };
}

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
  const [readOnly, setReadOnly] = useState(false);
  const [readOnlyBannerDismissed, setReadOnlyBannerDismissed] = useState(false);

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
        const parsed = (await parseRes.json()) as DocumentModel & { readOnly?: boolean; readOnlyReason?: string };
        const normalized = fileName.toLowerCase().endsWith('.hwp')
          ? normalizeHwpDocumentModel(parsed as HwpDocumentModel)
          : parsed;

        // HWP binary — viewer mode only
        if (parsed.readOnly) {
          setReadOnly(true);
        }

        setDocModel(normalized);
        historyRef.current = [normalized];
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
      // HWP 븷어보기 전용 다파일은 저장 차단
      if (readOnly) return;

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

  const handleSlideAdd = useCallback(
    (afterIdx: number) => {
      updateDocModel((prev) => {
        if (!prev || !isPresentationDocument(prev)) return prev;
        const newSlide = {
          slideNumber: prev.slides.length + 1,
          shapes: []
        };
        const updatedSlides = [...prev.slides];
        updatedSlides.splice(afterIdx + 1, 0, newSlide);
        updatedSlides.forEach((s, idx) => { s.slideNumber = idx + 1; });
        return { ...prev, slides: updatedSlides };
      });
    },
    [updateDocModel]
  );

  const handleSlideDuplicate = useCallback(
    (slideIdx: number) => {
      updateDocModel((prev) => {
        if (!prev || !isPresentationDocument(prev)) return prev;

        const target = prev.slides[slideIdx];
        if (!target) return prev;

        const duplicate: PresentationSlide = {
          ...target,
          slideNumber: 0,
          shapes: target.shapes.map((shape) => ({
            ...shape,
            formatting: { ...shape.formatting },
          })),
        };

        const updatedSlides = [...prev.slides];
        updatedSlides.splice(slideIdx + 1, 0, duplicate);
        updatedSlides.forEach((s, idx) => {
          s.slideNumber = idx + 1;
        });

        return { ...prev, slides: updatedSlides };
      });
    },
    [updateDocModel]
  );

  const handleSlideReplace = useCallback(
    (slideIdx: number, slide: PresentationSlide) => {
      updateDocModel((prev) => {
        if (!prev || !isPresentationDocument(prev)) return prev;
        const updatedSlides = prev.slides.map((s, idx) => (idx === slideIdx ? slide : s));
        return { ...prev, slides: updatedSlides };
      });
    },
    [updateDocModel]
  );

  const handleSlideDelete = useCallback(
    (slideIdx: number) => {
      updateDocModel((prev) => {
        if (!prev || !isPresentationDocument(prev)) return prev;
        if (prev.slides.length <= 1) {
          alert('마지막 슬라이드는 삭제할 수 없습니다.');
          return prev;
        }
        const updatedSlides = [...prev.slides];
        updatedSlides.splice(slideIdx, 1);
        updatedSlides.forEach((s, idx) => { s.slideNumber = idx + 1; });
        return { ...prev, slides: updatedSlides };
      });
    },
    [updateDocModel]
  );

  const handleShapeAdd = useCallback(
    (slideIdx: number, type: string = 'text', imageUrl?: string) => {
      updateDocModel((prev) => {
        if (!prev || !isPresentationDocument(prev)) return prev;
        const updatedSlides = [...prev.slides];
        const newShape: SlideShape = {
          type,
          text: type === 'text' ? '새 텍스트 상자' : (type === 'image' ? '' : '새 도형'),
          x: 100, y: 100, width: type === 'text' ? 300 : 150, height: type === 'text' ? 50 : 150,
          formatting: { bold: false, italic: false, underline: false, fontSize: 18, fontName: 'Calibri', color: '#000000', align: 'center' as const },
          backgroundColor: type !== 'text' && type !== 'image' ? '#e2e8f0' : undefined,
          borderColor: type !== 'text' && type !== 'image' ? '#64748b' : undefined,
          borderWidth: type !== 'text' && type !== 'image' ? 2 : undefined,
          imageUrl: type === 'image' ? imageUrl : undefined,
          imageFit: type === 'image' ? 'cover' : undefined
        };
        updatedSlides[slideIdx] = {
          ...updatedSlides[slideIdx],
          shapes: [...updatedSlides[slideIdx].shapes, newShape]
        };
        return { ...prev, slides: updatedSlides };
      });
    },
    [updateDocModel]
  );

  const handleShapeDelete = useCallback(
    (slideIdx: number, shapeIdx: number) => {
      updateDocModel((prev) => {
        if (!prev || !isPresentationDocument(prev)) return prev;
        const updatedSlides = [...prev.slides];
        const shapes = [...updatedSlides[slideIdx].shapes];
        shapes.splice(shapeIdx, 1);
        updatedSlides[slideIdx] = { ...updatedSlides[slideIdx], shapes };
        return { ...prev, slides: updatedSlides };
      });
    },
    [updateDocModel]
  );

  const handleSlideMove = useCallback(
    (slideIdx: number, direction: 'up' | 'down') => {
      updateDocModel((prev) => {
        if (!prev || !isPresentationDocument(prev)) return prev;
        const updatedSlides = [...prev.slides];
        if (direction === 'up' && slideIdx > 0) {
          const temp = updatedSlides[slideIdx];
          updatedSlides[slideIdx] = updatedSlides[slideIdx - 1];
          updatedSlides[slideIdx - 1] = temp;
        } else if (direction === 'down' && slideIdx < updatedSlides.length - 1) {
          const temp = updatedSlides[slideIdx];
          updatedSlides[slideIdx] = updatedSlides[slideIdx + 1];
          updatedSlides[slideIdx + 1] = temp;
        }
        updatedSlides.forEach((s, idx) => { s.slideNumber = idx + 1; });
        return { ...prev, slides: updatedSlides };
      });
    },
    [updateDocModel]
  );

  const handleSlideToggleVisibility = useCallback(
    (slideIdx: number) => {
      updateDocModel((prev) => {
        if (!prev || !isPresentationDocument(prev)) return prev;
        const updatedSlides = [...prev.slides];
        updatedSlides[slideIdx] = { ...updatedSlides[slideIdx], isHidden: !updatedSlides[slideIdx].isHidden };
        return { ...prev, slides: updatedSlides };
      });
    },
    [updateDocModel]
  );

  const handleSlideNotesUpdate = useCallback(
    (slideIdx: number, notes: string) => {
      updateDocModel((prev) => {
        if (!prev || !isPresentationDocument(prev)) return prev;
        const updatedSlides = [...prev.slides];
        updatedSlides[slideIdx] = { ...updatedSlides[slideIdx], notes };
        return { ...prev, slides: updatedSlides };
      });
    },
    [updateDocModel]
  );

  const handleAITranslate = useCallback(
    (slideIdx: number) => {
      alert("✨ AI 분석 완료: 슬라이드 내 모든 텍스트를 대상 언어(Mock)로 번역합니다.");
      updateDocModel((prev) => {
        if (!prev || !isPresentationDocument(prev)) return prev;
        const updatedSlides = [...prev.slides];
        const shapes = updatedSlides[slideIdx].shapes.map(shape => {
          if (!shape.text || shape.type === 'image') return shape;
          // Mock translation: Reverse the string or append (Translated)
          return { ...shape, text: shape.text + " (Translated)" };
        });
        updatedSlides[slideIdx] = { ...updatedSlides[slideIdx], shapes };
        return { ...prev, slides: updatedSlides };
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
  const isHwpFile = currentFileType === 'hwp';
  const hwpModel = isHwpFile ? (docModel as HwpDocumentModel) : null;
  const hwpDocInfo = hwpModel?.docInfo;
  const hwpFaceNameCount = hwpDocInfo?.hangulFaceNames?.length ?? 0;
  const hwpCharShapeCount = hwpDocInfo?.charShapes?.length ?? 0;
  const hwpParaShapeCount = hwpDocInfo?.paraShapes?.length ?? 0;
  const hwpBorderFillCount = hwpDocInfo?.borderFills?.length ?? 0;
  const hwpStyleCount = hwpDocInfo?.styles?.length ?? 0;
  const hwpNumberingCount = hwpDocInfo?.numberings?.length ?? 0;
  const hwpBulletCount = hwpDocInfo?.bullets?.length ?? 0;
  const mainLayoutClass = isSpreadsheetDocument(docModel)
    ? styles.mainExcel
    : isPresentationDocument(docModel)
      ? styles.mainPpt
      : styles.mainDefault;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={handleBackToDashboard}>
          &larr; Back
        </button>
        <span className={styles.fileName}>{fileName}</span>
        {readOnly && (
          <span style={{
            marginLeft: '12px', padding: '3px 10px', borderRadius: '20px',
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
            color: '#f87171', fontSize: '11px', fontWeight: 600,
          }}>
            뷰어 전용
          </span>
        )}
      </header>

      {/* Read-only / format info banner */}
      {readOnly && !readOnlyBannerDismissed && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 20px',
          background: 'linear-gradient(90deg, rgba(239,68,68,0.12), rgba(239,68,68,0.06))',
          borderBottom: '1px solid rgba(239,68,68,0.25)',
          fontSize: '13px', color: '#fca5a5',
        }}>
          <span>🔒</span>
          <span>
            <b>편집 제한</b> &mdash; 이 문서는 현재 잠겨 있어 수정이 비활성화되었습니다.
            내보내기 패널에서 다른 형식으로 저장할 수 있습니다.
          </span>
          <button
            onClick={() => setReadOnlyBannerDismissed(true)}
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '18px' }}
          >&times;</button>
        </div>
      )}

      {currentFileType === 'xls' || currentFileType === 'xlsx' ? (
        <ExcelRibbon
          saveStatus={saveStatus}
          lastSavedTime={lastSavedTime}
          onAction={handleSpreadsheetRibbonAction}
          onExportPdf={handleExportPdf}
          fileName={fileName}
          token={user?.token}
          getDocumentModel={() => docModel}
          exportOptions={EXCEL_EXPORT_OPTIONS}
        />
      ) : currentFileType === 'pptx' ? (
        <PowerPointRibbon
          saveStatus={saveStatus}
          lastSavedTime={lastSavedTime}
          onAction={handlePresentationRibbonAction}
          onExportPdf={handleExportPdf}
          fileName={fileName}
          token={user?.token}
          getDocumentModel={() => docModel}
          exportOptions={PPT_EXPORT_OPTIONS}
        />
      ) : currentFileType === 'hwp' || currentFileType === 'hwpx' ? (
        <div style={{ position: 'relative' }}>
          <HanwordRibbon
            saveStatus={saveStatus}
            lastSavedTime={lastSavedTime}
            onAction={readOnly ? () => {} : handleTextRibbonAction}
            onExportPdf={handleExportPdf}
            fileName={fileName}
            token={user?.token}
            getDocumentModel={() => docModel}
            exportOptions={currentFileType === 'hwp' ? HWP_EXPORT_OPTIONS : HWPX_EXPORT_OPTIONS}
          />
          {isHwpFile && hwpDocInfo && (
            <div style={{
              margin: '10px 20px 0',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '14px',
              border: '1px solid rgba(122,162,247,0.22)',
              background: 'linear-gradient(180deg, rgba(15,23,42,0.9), rgba(15,23,42,0.78))',
              color: '#cbd5e1',
              fontSize: '12px',
            }}>
              <span style={{ color: '#7aa2f7', fontWeight: 700 }}>HWP docInfo</span>
              <span>글꼴 {hwpFaceNameCount}</span>
              <span>문자서식 {hwpCharShapeCount}</span>
              <span>문단서식 {hwpParaShapeCount}</span>
              <span>윤곽/테두리 {hwpBorderFillCount}</span>
              <span>스타일 {hwpStyleCount}</span>
              <span>번호 {hwpNumberingCount}</span>
              <span>글머리표 {hwpBulletCount}</span>
            </div>
          )}
        </div>
      ) : (
        <WordRibbon
          saveStatus={saveStatus}
          lastSavedTime={lastSavedTime}
          onAction={handleTextRibbonAction}
          onExportPdf={handleExportPdf}
          fileName={fileName}
          token={user?.token}
          getDocumentModel={() => docModel}
          exportOptions={TEXT_EXPORT_OPTIONS}
        />
      )}

      <LibraryApiPanel token={user?.token} />

      <main className={`${styles.mainArea} ${mainLayoutClass}`}>
        {isHwpFile && hwpModel && (
          <HwpInspectorPanel
            model={hwpModel}
            onModelChange={(updatedModel) => updateDocModel(updatedModel)}
          />
        )}
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
            onSlideAdd={handleSlideAdd}
            onSlideDuplicate={handleSlideDuplicate}
            onSlideDelete={handleSlideDelete}
            onSlideReplace={handleSlideReplace}
            onShapeAdd={handleShapeAdd}
            onShapeDelete={handleShapeDelete}
            onSlideMove={handleSlideMove}
            onSlideToggleVisibility={handleSlideToggleVisibility}
            onSlideNotesUpdate={handleSlideNotesUpdate}
            onAITranslate={handleAITranslate}
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
