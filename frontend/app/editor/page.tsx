'use client';

import { Suspense } from 'react';
import EditorInner from './EditorInner';

/**
 * /editor?file=filename.hwp
 *
 * Wraps in Suspense because EditorInner uses useSearchParams()
 * which requires it in Next.js 15 App Router.
 */
export default function EditorPage() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#f1f3f5', color: '#495057',
        fontFamily: 'Inter, sans-serif', fontSize: '1.1rem',
        gap: '1rem',
      }}>
        <span style={{ fontSize: '2rem' }}>📄</span>
        문서를 불러오는 중...
      </div>
    }>
      <EditorInner />
    </Suspense>
  );
}
