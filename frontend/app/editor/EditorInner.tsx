'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import DocumentCanvas from '../components/DocumentCanvas';
import styles from './editor.module.css';

interface DocumentModel {
  title: string;
  format: string;
  sections: Section[];
  fontMap?: Record<string, string>;
}

interface Section {
  paragraphs: Paragraph[];
}

interface Paragraph {
  text: string;
  fontName?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: 'left' | 'center' | 'right' | 'justify';
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

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

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={handleBackToDashboard}>
          ← Back
        </button>
        <span className={styles.fileName}>{fileName}</span>
        <div className={styles.spacer}></div>
        <div className={`${styles.saveStatus} ${styles[saveStatus]}`}>
          {saveStatus === 'idle' && 'Ready'}
          {saveStatus === 'saving' && 'Saving...'}
          {saveStatus === 'saved' && '✓ Saved'}
          {saveStatus === 'error' && '✗ Error'}
        </div>
        {lastSavedTime && <span className={styles.lastSaved}>Last: {lastSavedTime}</span>}
      </header>

      <main style={{ flex: 1, overflow: 'auto' }}>
        <DocumentCanvas document={docModel} onContentChange={handleContentChange} />
      </main>
    </div>
  );
}
