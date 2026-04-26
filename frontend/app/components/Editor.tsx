'use client';

import React, { useState, useEffect } from 'react';
import styles from './Editor.module.css';

import { DocumentModel } from '../types/document';

interface EditorProps {
  documentModel: DocumentModel | null; // The decoupled JSON model bound to Web Nodes created by DocumentController
}

export default function WYSIWYGEditor({ documentModel }: EditorProps) {
  // In a real SPA, this tracks current content from the Rust/WASM or Controller nodes
  const [contentHtml, setContentHtml] = useState<string>('');

  useEffect(() => {
    if (documentModel) {
      // Logic binding: mapped nodes to semantic HTML or React elements dynamically.
      setContentHtml(`<p class="hwp-paragraph">${documentModel.title || 'Document body content loading...'}</p>`);
    } else {
      setContentHtml('<h1 class="hwp-heading">New Blank Canvas...</h1><p>Welcome to your naesungOffice workspace.</p>');
    }
  }, [documentModel]);

  return (
    <div className={styles.editorShell}>
      {/* Universal Ribbon / Toolbar Menu */}
      <div className={styles.toolbar}>
        <div className={styles.toolGroup}>
          <select className={styles.fontSelect}>
            <option value="NanumGothic">NanumGothic</option>
            <option value="HamchoromBatang">HamchoromBatang</option>
            <option value="Arial">Arial</option>
          </select>
          <select className={styles.sizeSelect}>
            <option value="10">10</option>
            <option value="12">12</option>
            <option value="14">14</option>
            <option value="16">16</option>
          </select>
        </div>
        
        <div className={styles.toolGroup}>
          <button className={styles.toolBtn}><strong>B</strong></button>
          <button className={styles.toolBtn}><em>I</em></button>
          <button className={styles.toolBtn}><u>U</u></button>
        </div>

        <div className={styles.toolGroup}>
          <button className={styles.actionBtn}>Commit Object to Cloud</button>
        </div>
      </div>

      {/* Editor Canvas Container representing an A4 scale */}
      <div className={styles.canvasArea}>
        <div 
          className={styles.documentPage}
          contentEditable={true}
          dangerouslySetInnerHTML={{ __html: contentHtml }}
          suppressContentEditableWarning={true}
        />
      </div>
    </div>
  );
}
