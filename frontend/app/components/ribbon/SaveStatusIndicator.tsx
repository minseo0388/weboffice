import React from 'react';
import styles from './OfficeRibbon.module.css';
import { SaveStatus } from '../../types/document';

interface SaveStatusIndicatorProps {
  saveStatus: SaveStatus;
  lastSavedTime: string;
}

export default function SaveStatusIndicator({ saveStatus, lastSavedTime }: SaveStatusIndicatorProps) {
  return (
    <div className={styles.saveArea}>
      <span className={`${styles.saveBadge} ${styles[saveStatus]}`}>
        {saveStatus === 'idle' && 'Ready'}
        {saveStatus === 'saving' && 'Saving...'}
        {saveStatus === 'saved' && 'Saved'}
        {saveStatus === 'error' && 'Error'}
      </span>
      {lastSavedTime && <span className={styles.lastSaved}>Last: {lastSavedTime}</span>}
    </div>
  );
}
