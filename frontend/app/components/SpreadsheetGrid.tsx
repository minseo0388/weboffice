'use client';

import React, { useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import styles from './SpreadsheetGrid.module.css';
import { SpreadsheetCell, SpreadsheetSheet, SpreadsheetToolAction } from '../types/document';

interface SpreadsheetGridProps {
  sheets: SpreadsheetSheet[];
  onCellChange: (sheetIdx: number, rowIdx: number, cellIdx: number, cell: SpreadsheetCell) => void;
  onSheetReplace: (sheetIdx: number, sheet: SpreadsheetSheet) => void;
}

export interface SpreadsheetGridHandle {
  applyAction: (action: SpreadsheetToolAction) => void;
}

/**
 * SpreadsheetGrid: Renders Excel-style grid interface for XLSX editing.
 * Supports multi-sheet navigation and cell editing.
 */
const SpreadsheetGrid = forwardRef<SpreadsheetGridHandle, SpreadsheetGridProps>(function SpreadsheetGrid(
  { sheets, onCellChange, onSheetReplace }: SpreadsheetGridProps,
  ref
) {
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [editCell, setEditCell] = useState<{ row: number; col: number } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');

  const activeSheet = sheets[activeSheetIdx];

  const handleCellClick = (rowIdx: number, colIdx: number, currentValue: string | number | boolean) => {
    setSelectedCell({ row: rowIdx, col: colIdx });
    setEditCell({ row: rowIdx, col: colIdx });
    setEditValue(String(currentValue));
  };

  const handleCellSave = useCallback(() => {
    if (editCell) {
      const currentCell = activeSheet.grid[editCell.row]?.[editCell.col];
      const updatedCell: SpreadsheetCell = {
        ...(currentCell || { row: editCell.row, col: editCell.col, type: 'string', value: '' }),
        value: editValue,
      };
      onCellChange(activeSheetIdx, editCell.row, editCell.col, updatedCell);
      setEditCell(null);
    }
  }, [editCell, editValue, activeSheetIdx, onCellChange, activeSheet]);

  useImperativeHandle(ref, () => ({
    applyAction: (action: SpreadsheetToolAction) => {
      if (!selectedCell) {
        return;
      }

      const currentCell = activeSheet.grid[selectedCell.row]?.[selectedCell.col];
      if (!currentCell) {
        return;
      }

      if (action.type === 'sortColumn') {
        const sortedRows = [...activeSheet.grid].sort((rowA, rowB) => {
          const a = String(rowA[selectedCell.col]?.value ?? '');
          const b = String(rowB[selectedCell.col]?.value ?? '');
          return action.direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
        });

        onSheetReplace(activeSheetIdx, {
          ...activeSheet,
          grid: sortedRows,
        });
        return;
      }

      if (action.type === 'formula') {
        onCellChange(activeSheetIdx, selectedCell.row, selectedCell.col, {
          ...currentCell,
          type: 'formula',
          value: action.value,
        });
        return;
      }

      if (action.type === 'formatPainter') {
        return;
      }

      if (action.type === 'mergeCell') {
        onCellChange(activeSheetIdx, selectedCell.row, selectedCell.col, {
          ...currentCell,
          merged: !currentCell.merged,
        });
        return;
      }

      if (action.type === 'textColor') {
        onCellChange(activeSheetIdx, selectedCell.row, selectedCell.col, {
          ...currentCell,
          textColor: action.value,
        });
        return;
      }

      if (action.type === 'backgroundColor') {
        onCellChange(activeSheetIdx, selectedCell.row, selectedCell.col, {
          ...currentCell,
          backgroundColor: action.value,
        });
        return;
      }

      if (action.type === 'bold' || action.type === 'italic' || action.type === 'underline') {
        const key = action.type;
        onCellChange(activeSheetIdx, selectedCell.row, selectedCell.col, {
          ...currentCell,
          [key]: !currentCell[key],
        });
      }
    },
  }), [selectedCell, activeSheet, activeSheetIdx, onCellChange, onSheetReplace]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellSave();
    } else if (e.key === 'Escape') {
      setEditCell(null);
    }
  };

  if (!activeSheet) {
    return <div className={styles.container}>No sheets available</div>;
  }

  return (
    <div className={styles.container}>
      {/* Sheet Tabs */}
      <div className={styles.sheetTabs}>
        {sheets.map((sheet, idx) => (
          <button
            key={idx}
            className={`${styles.sheetTab} ${activeSheetIdx === idx ? styles.active : ''}`}
            onClick={() => setActiveSheetIdx(idx)}
          >
            {sheet.name || `Sheet ${idx + 1}`}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className={styles.gridContainer}>
        <table className={styles.grid}>
          <tbody>
            {activeSheet.grid.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {/* Row number */}
                <td className={styles.rowHeader}>{rowIdx + 1}</td>

                {/* Cells */}
                {row.map((cell, colIdx) => (
                  <td
                    key={`${rowIdx}-${colIdx}`}
                    className={`${styles.gridCell} ${selectedCell?.row === rowIdx && selectedCell?.col === colIdx ? styles.selected : ''}`}
                    onClick={() => handleCellClick(rowIdx, colIdx, cell.value)}
                    style={{
                      fontWeight: cell.bold ? 'bold' : 'normal',
                      fontStyle: cell.italic ? 'italic' : 'normal',
                      textDecoration: cell.underline ? 'underline' : 'none',
                      color: cell.textColor || 'inherit',
                      backgroundColor: cell.backgroundColor || undefined,
                    }}
                  >
                    {editCell?.row === rowIdx && editCell?.col === colIdx ? (
                      <input
                        type="text"
                        className={styles.cellInput}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCellSave}
                        onKeyDown={handleKeyDown}
                        autoFocus
                      />
                    ) : (
                      <span>{cell.value}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default SpreadsheetGrid;
