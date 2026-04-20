'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import styles from './editor.module.css';

interface DocumentModel {
  title: string;
  sectionCount: number;
  sections?: SectionModel[];
}

interface SectionModel {
  paragraphs: ParagraphModel[];
}

interface ParagraphModel {
  text: string;
  fontName: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: 'left' | 'center' | 'right' | 'justify';
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const FONT_OPTIONS = [
  'NanumGothic', 'NanumMyeongjo', 'HamchoromBatang', 'HamchoromDotum',
  'UnBatang', 'Arial', 'Times New Roman',
];

export default function EditorInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileName = searchParams.get('file') ?? '';

  const [docModel, setDocModel] = useState<DocumentModel | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // Toolbar state
  const [fontName, setFontName]   = useState('NanumGothic');
  const [fontSize, setFontSize]   = useState(14);
  const [bold, setBold]           = useState(false);
  const [italic, setItalic]       = useState(false);
  const [underline, setUnderline] = useState(false);
  const [textColor, setTextColor] = useState('#212529');
  const [bgColor, setBgColor]     = useState('#ffffff');
  const [lineHeight, setLineHeight] = useState('1.75');

  const editorRef = useRef<HTMLDivElement>(null);
  const authHeader = { Authorization: `Bearer ${user?.token}` } as const;

  // ── 1. Download the raw file, then parse it via /api/documents/parse ─────────
  const loadDocument = useCallback(async () => {
    if (!user || !fileName) return;
    setLoading(true);
    setError(null);

    try {
      // Step 1: Download the user's file bytes from OCI
      const fileRes = await fetch(
        `/api/storage/download/${encodeURIComponent(fileName)}`,
        { headers: authHeader }
      );
      if (!fileRes.ok) throw new Error(`파일 다운로드 실패: ${fileRes.status}`);
      const blob = await fileRes.blob();

      // Step 2: Send to the hwplib parser endpoint
      const form = new FormData();
      form.append('file', blob, fileName);

      const parseRes = await fetch('/api/documents/parse', {
        method: 'POST',
        headers: authHeader,
        body: form,
      });
      if (!parseRes.ok) throw new Error(`문서 파싱 실패: ${parseRes.status}`);

      const model = await parseRes.json() as DocumentModel;
      setDocModel(model);

      // Render initial content into the editable div
      if (editorRef.current) {
        editorRef.current.innerHTML = renderModelToHtml(model);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, [user, fileName]);

  useEffect(() => {
    if (!user) { router.replace('/'); return; }
    if (!fileName) { router.replace('/dashboard'); return; }
    loadDocument();
  }, [loadDocument, user, fileName, router]);

  // ── 2. Convert document model to editable HTML ──────────────────────────────
  function renderModelToHtml(model: DocumentModel): string {
    if (!model.sections?.length) {
      return `<p style="font-family:'NanumGothic',sans-serif;font-size:14pt;">
        ${model.title || '(빈 문서)'}
      </p>`;
    }
    return model.sections
      .flatMap((sec) => sec.paragraphs)
      .map((p) => {
        const style = [
          `font-family:'${p.fontName}',sans-serif`,
          `font-size:${p.fontSize}pt`,
          p.bold      ? 'font-weight:bold'      : '',
          p.italic    ? 'font-style:italic'     : '',
          p.underline ? 'text-decoration:underline' : '',
          `text-align:${p.align}`,
        ].filter(Boolean).join(';');
        return `<p style="${style}">${escapeHtml(p.text)}</p>`;
      })
      .join('');
  }

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ── 3. Apply formatting commands to the contentEditable ─────────────────────
  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleFontChange = (f: string) => {
    setFontName(f);
    applyFormat('fontName', f);
  };
  const handleSizeChange = (s: number) => {
    setFontSize(s);
    document.execCommand('fontSize', false, '7');
    const spans = editorRef.current?.querySelectorAll('font[size="7"]');
    spans?.forEach((el) => {
      (el as HTMLElement).removeAttribute('size');
      (el as HTMLElement).style.fontSize = `${s}pt`;
    });
    editorRef.current?.focus();
  };
  const handleColorChange = (cmd: string, color: string, setter: (c: string) => void) => {
    setter(color);
    applyFormat(cmd, color);
  };

  const handleInsertTable = () => {
    const rows = prompt("줄 수를 입력하세요", "3");
    const cols = prompt("칸 수를 입력하세요", "3");
    if (!rows || !cols) return;
    
    let tableHtml = '<table style="width:100%; border-collapse:collapse; margin-bottom:1rem; border:1px solid #dee2e6;"><tbody>';
    for (let r = 0; r < Number(rows); r++) {
      tableHtml += '<tr>';
      for (let c = 0; c < Number(cols); c++) {
        tableHtml += '<td style="border:1px solid #dee2e6; padding:0.5rem; min-width:50px;">&nbsp;</td>';
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table><p>&nbsp;</p>';
    applyFormat('insertHTML', tableHtml);
  };

  const handleInsertImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            applyFormat('insertHTML', `<img src="${e.target.result}" style="max-width:100%; height:auto; margin:0.5rem 0;" />`);
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleLineHeight = (val: string) => {
    setLineHeight(val);
    if (editorRef.current) {
      editorRef.current.style.lineHeight = val;
    }
  };

  // ── 4. Save — upload modified HTML back as .hwp placeholder ─────────────────
  const handleSave = async () => {
    if (!user || !editorRef.current) return;
    setSaveStatus('saving');
    try {
      const htmlContent = editorRef.current.innerHTML;
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const form = new FormData();
      form.append('file', blob, fileName);

      const res = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: authHeader,
        body: form,
      });
      if (!res.ok) throw new Error();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const saveLabel: Record<SaveStatus, string> = {
    idle:   '☁  저장',
    saving: '저장 중...',
    saved:  '✓ 저장됨',
    error:  '✗ 저장 실패',
  };

  if (!user) return null;

  return (
    <div className={styles.shell}>
      {/* ── Ribbon Toolbar ── */}
      <div className={styles.ribbon}>
        {/* Back */}
        <button className={styles.backBtn} onClick={() => router.push('/dashboard')}>
          ← 드라이브
        </button>

        <div className={styles.separator} />

        {/* Font */}
        <select
          className={styles.select}
          value={fontName}
          onChange={(e) => handleFontChange(e.target.value)}
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        {/* Size */}
        <select
          className={styles.select}
          value={fontSize}
          onChange={(e) => handleSizeChange(Number(e.target.value))}
        >
          {[9, 10, 11, 12, 14, 16, 18, 24, 32, 48].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <div className={styles.separator} />

        {/* Formatting */}
        <button
          className={`${styles.fmtBtn} ${bold ? styles.active : ''}`}
          onClick={() => { setBold(!bold); applyFormat('bold'); }}
          title="굵게 (Ctrl+B)"
        ><strong>B</strong></button>

        <button
          className={`${styles.fmtBtn} ${italic ? styles.active : ''}`}
          onClick={() => { setItalic(!italic); applyFormat('italic'); }}
          title="기울임 (Ctrl+I)"
        ><em>I</em></button>

        <button
          className={`${styles.fmtBtn} ${underline ? styles.active : ''}`}
          onClick={() => { setUnderline(!underline); applyFormat('underline'); }}
          title="밑줄 (Ctrl+U)"
        ><u>U</u></button>

        <div className={styles.separator} />

        {/* Align */}
        <button className={styles.fmtBtn} onClick={() => applyFormat('justifyLeft')}>⬛⬜⬜</button>
        <button className={styles.fmtBtn} onClick={() => applyFormat('justifyCenter')}>⬜⬛⬜</button>
        <button className={styles.fmtBtn} onClick={() => applyFormat('justifyRight')}>⬜⬜⬛</button>

        <div className={styles.spacer} />

        {/* Undo/Redo */}
        <button className={styles.fmtBtn} onClick={() => applyFormat('undo')} title="실행 취소 (Ctrl+Z)">↺</button>
        <button className={styles.fmtBtn} onClick={() => applyFormat('redo')} title="다시 실행 (Ctrl+Y)">↻</button>

        <div className={styles.separator} />

        {/* Text Colors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
          <label style={{ fontSize: '0.6rem', color: '#868e96' }}>글꼴색</label>
          <input type="color" value={textColor} onChange={(e) => handleColorChange('foreColor', e.target.value, setTextColor)} style={{ width: '24px', height: '24px', padding: 0, border: 'none' }} title="글자 색상" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
          <label style={{ fontSize: '0.6rem', color: '#868e96' }}>배경색</label>
          <input type="color" value={bgColor} onChange={(e) => handleColorChange('hiliteColor', e.target.value, setBgColor)} style={{ width: '24px', height: '24px', padding: 0, border: 'none' }} title="글자 배경색" />
        </div>

        <div className={styles.separator} />

        {/* List & Indent */}
        <button className={styles.fmtBtn} onClick={() => applyFormat('insertUnorderedList')} title="글머리 기호">⦁—</button>
        <button className={styles.fmtBtn} onClick={() => applyFormat('insertOrderedList')} title="번호 매기기">1.—</button>
        <button className={styles.fmtBtn} onClick={() => applyFormat('indent')} title="들여쓰기">⇥</button>
        <button className={styles.fmtBtn} onClick={() => applyFormat('outdent')} title="내어쓰기">⇤</button>

        <div className={styles.separator} />

        {/* Advanced Objects */}
        <button className={styles.objectBtn} onClick={handleInsertTable} title="표 삽입">
          <span>▦</span> 표
        </button>
        <button className={styles.objectBtn} onClick={handleInsertImage} title="그림 삽입">
          <span>🖼</span> 그림
        </button>

        <div className={styles.spacer} />

        {/* Filename */}
        <span className={styles.fileName}>
          {fileName}
        </span>

        {/* Save */}
        <button
          className={`${styles.saveBtn} ${styles[saveStatus]}`}
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
        >
          {saveLabel[saveStatus]}
        </button>
      </div>

      {/* ── Editor Canvas ── */}
      <div className={styles.canvas}>
        {loading ? (
          <div className={styles.loadingMsg}>
            <span className={styles.spinner} />
            hwplib로 문서를 분석 중...
          </div>
        ) : error ? (
          <div className={styles.errorMsg}>
            <p>⚠ {error}</p>
            <button onClick={loadDocument}>다시 시도</button>
          </div>
        ) : (
          <div
            ref={editorRef}
            className={styles.page}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
