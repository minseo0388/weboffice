'use client';

import React, { useRef, useState } from 'react';
import styles from './ExportMenu.module.css';

export interface ExportOption {
  format: string;
  label: string;
  icon: string;
}

interface ExportMenuProps {
  fileName: string;
  token: string | undefined;
  getDocumentModel: () => object | null;
  options: ExportOption[];
}

/**
 * ExportMenu — a dropdown button that exports the current document
 * to any supported format via POST /api/documents/export.
 *
 * Props:
 *   fileName        — original file name (used as the download base name)
 *   token           — Bearer JWT
 *   getDocumentModel — callback that returns the current in-memory doc model
 *   options         — list of export formats to show
 */
export default function ExportMenu({ fileName, token, getDocumentModel, options }: ExportMenuProps) {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const menuRef               = useRef<HTMLDivElement>(null);

  const handleExport = async (format: string, label: string) => {
    const documentModel = getDocumentModel();
    if (!documentModel || !token) {
      setError('문서 모델을 불러올 수 없습니다.');
      setOpen(false);
      return;
    }

    setLoading(label);
    setOpen(false);
    setError(null);

    try {
      const res = await fetch('/api/documents/export', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ format, fileName, documentModel }),
      });

      if (!res.ok) {
        throw new Error(`서버 오류: ${res.status}`);
      }

      // Trigger browser download
      const blob  = await res.blob();
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement('a');
      const base  = fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
      // hwpx content-type is application/hwpx+zip; ext = hwpx
      const ext   = format === 'hwpx' ? 'hwpx' : format;
      a.href      = url;
      a.download  = `${base}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : '내보내기 실패');
    } finally {
      setLoading(null);
    }
  };

  // Close on outside click
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!menuRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
    }
  };

  return (
    <div
      className={styles.wrap}
      ref={menuRef}
      onBlur={handleBlur}
      tabIndex={-1}
    >
      <button
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        disabled={loading !== null}
        title="내보내기"
        id="export-menu-trigger"
      >
        {loading ? `⏳ ${loading}...` : '⬇ 내보내기 ▾'}
      </button>

      {open && (
        <div className={styles.dropdown} role="menu">
          {options.map((opt) => (
            <button
              key={opt.format}
              className={styles.item}
              onClick={() => handleExport(opt.format, opt.label)}
              role="menuitem"
              id={`export-${opt.format}`}
            >
              <span className={styles.itemIcon}>{opt.icon}</span>
              <span className={styles.itemLabel}>{opt.label}</span>
              <span className={styles.itemExt}>.{opt.format}</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <span className={styles.error} role="alert">
          ⚠ {error}
        </span>
      )}
    </div>
  );
}
