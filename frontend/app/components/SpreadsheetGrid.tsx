'use client';

import React, { useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import styles from './SpreadsheetGrid.module.css';
import { SpreadsheetCell, SpreadsheetSheet, SpreadsheetToolAction } from '../types/document';
import { evaluateFormula } from '../../utils/excelFunctions';

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
  const [selectedRange, setSelectedRange] = useState<{ start: {row: number, col: number}, end: {row: number, col: number} } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [editValue, setEditValue] = useState('');

  // Undo/Redo history per sheet index
  const historyRef = React.useRef<SpreadsheetSheet[][]>([]);
  const futureRef  = React.useRef<SpreadsheetSheet[][]>([]);
  const clipboardRef = React.useRef<SpreadsheetCell | null>(null);

  const pushHistory = React.useCallback((currentSheets: SpreadsheetSheet[]) => {
    historyRef.current = [...historyRef.current.slice(-49), JSON.parse(JSON.stringify(currentSheets))];
    futureRef.current  = [];
  }, []);

  const activeSheet = sheets[activeSheetIdx];

  const toColName = (col: number) => {
    let n = col + 1;
    let result = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      result = String.fromCharCode(65 + rem) + result;
      n = Math.floor((n - 1) / 26);
    }
    return result;
  };

  const getSelectedA1Range = () => {
    if (!selectedCell) return null;
    const startRow = selectedRange ? Math.min(selectedRange.start.row, selectedRange.end.row) : selectedCell.row;
    const endRow = selectedRange ? Math.max(selectedRange.start.row, selectedRange.end.row) : selectedCell.row;
    const startCol = selectedRange ? Math.min(selectedRange.start.col, selectedRange.end.col) : selectedCell.col;
    const endCol = selectedRange ? Math.max(selectedRange.start.col, selectedRange.end.col) : selectedCell.col;

    const startA1 = `${toColName(startCol)}${startRow + 1}`;
    const endA1 = `${toColName(endCol)}${endRow + 1}`;
    return startA1 === endA1 ? startA1 : `${startA1}:${endA1}`;
  };

  const handlePointerDown = (rowIdx: number, colIdx: number, currentValue: string | number | boolean) => {
    if (editCell && editCell.row === rowIdx && editCell.col === colIdx) return;
    handleCellSave();
    setIsDragging(true);
    setSelectedCell({ row: rowIdx, col: colIdx });
    setSelectedRange({ start: { row: rowIdx, col: colIdx }, end: { row: rowIdx, col: colIdx } });
    setEditValue(String(currentValue));
  };

  const handlePointerEnter = (rowIdx: number, colIdx: number) => {
    if (isDragging && selectedRange) {
      setSelectedRange({ ...selectedRange, end: { row: rowIdx, col: colIdx } });
    }
  };

  React.useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('pointerup', handleMouseUp);
    return () => window.removeEventListener('pointerup', handleMouseUp);
  }, []);

  const handleCellSave = useCallback(() => {
    if (editCell) {
      const currentCell = activeSheet.grid[editCell.row]?.[editCell.col];
      const isFormula = editValue.startsWith('=');
      const updatedCell: SpreadsheetCell = {
        ...(currentCell || { row: editCell.row, col: editCell.col, type: 'string', value: '' }),
        type: isFormula ? 'formula' : (isNaN(Number(editValue)) || editValue.trim() === '' ? 'string' : 'number'),
        value: editValue,
      };
      onCellChange(activeSheetIdx, editCell.row, editCell.col, updatedCell);
      setEditCell(null);
    }
  }, [editCell, editValue, activeSheetIdx, onCellChange, activeSheet]);

  useImperativeHandle(ref, () => ({
    applyAction: (action: SpreadsheetToolAction) => {
      // ── Undo / Redo ───────────────────────────────────────────
      if (action.type === 'undo') {
        const prev = historyRef.current.pop();
        if (prev) { futureRef.current.push(JSON.parse(JSON.stringify(sheets))); prev.forEach((s, i) => onSheetReplace(i, s)); }
        return;
      }
      if (action.type === 'redo') {
        const next = futureRef.current.pop();
        if (next) { historyRef.current.push(JSON.parse(JSON.stringify(sheets))); next.forEach((s, i) => onSheetReplace(i, s)); }
        return;
      }

      // ── Add/Delete row ────────────────────────────────────────
      if (action.type === 'addRow') {
        pushHistory(sheets);
        const insertAt = selectedCell ? selectedCell.row + 1 : activeSheet.grid.length;
        const cols = activeSheet.grid[0]?.length || 10;
        const newRow = Array.from({ length: cols }, (_, c) => ({ row: insertAt, col: c, type: 'string' as const, value: '' }));
        const newGrid = [
          ...activeSheet.grid.slice(0, insertAt).map((r, ri) => r.map(c => ({ ...c, row: ri }))),
          newRow,
          ...activeSheet.grid.slice(insertAt).map((r, ri) => r.map(c => ({ ...c, row: insertAt + 1 + ri }))),
        ];
        onSheetReplace(activeSheetIdx, { ...activeSheet, grid: newGrid, rowCount: newGrid.length });
        return;
      }
      if (action.type === 'deleteRow' && selectedCell) {
        pushHistory(sheets);
        const newGrid = activeSheet.grid.filter((_, ri) => ri !== selectedCell.row).map((r, ri) => r.map(c => ({ ...c, row: ri })));
        onSheetReplace(activeSheetIdx, { ...activeSheet, grid: newGrid, rowCount: newGrid.length });
        setSelectedCell(null);
        return;
      }

      // ── Add/Delete column ─────────────────────────────────────
      if (action.type === 'addCol') {
        pushHistory(sheets);
        const insertAt = selectedCell ? selectedCell.col + 1 : (activeSheet.grid[0]?.length || 0);
        const newGrid = activeSheet.grid.map((row, ri) => [
          ...row.slice(0, insertAt),
          { row: ri, col: insertAt, type: 'string' as const, value: '' },
          ...row.slice(insertAt).map(c => ({ ...c, col: c.col + 1 })),
        ]);
        onSheetReplace(activeSheetIdx, { ...activeSheet, grid: newGrid, columnCount: newGrid[0]?.length || 0 });
        return;
      }
      if (action.type === 'deleteCol' && selectedCell) {
        pushHistory(sheets);
        const newGrid = activeSheet.grid.map((row) =>
          row.filter((_, ci) => ci !== selectedCell.col).map((c, ci) => ({ ...c, col: ci }))
        );
        onSheetReplace(activeSheetIdx, { ...activeSheet, grid: newGrid, columnCount: newGrid[0]?.length || 0 });
        setSelectedCell(null);
        return;
      }

      // ── Add/Delete sheet ─────────────────────────────────────
      if (action.type === 'addSheet') {
        pushHistory(sheets);
        const newIdx = sheets.length;
        const cols = 10;
        const rows = 20;
        const newGrid = Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => ({ row: r, col: c, type: 'string' as const, value: '' }))
        );
        onSheetReplace(newIdx, { sheetIndex: newIdx, name: `Sheet${newIdx + 1}`, rowCount: rows, columnCount: cols, grid: newGrid });
        setActiveSheetIdx(newIdx);
        return;
      }
      if (action.type === 'deleteSheet' && sheets.length > 1) {
        pushHistory(sheets);
        // Remove current sheet — parent must handle sheet removal
        // We signal by replacing with an empty-grid sheet named __DELETE__
        onSheetReplace(activeSheetIdx, { ...activeSheet, name: '__DELETE__' });
        setActiveSheetIdx(Math.max(0, activeSheetIdx - 1));
        return;
      }

      // ── Freeze rows / cols ────────────────────────────────────
      if (action.type === 'freezeRows') {
        onSheetReplace(activeSheetIdx, { ...activeSheet, frozenRows: action.count });
        return;
      }
      if (action.type === 'freezeCols') {
        onSheetReplace(activeSheetIdx, { ...activeSheet, frozenCols: action.count });
        return;
      }

      // ── Copy / Paste ───────────────────────────────────────────
      if (action.type === 'copyRange' && selectedCell) {
        clipboardRef.current = { ...activeSheet.grid[selectedCell.row]?.[selectedCell.col] };
        return;
      }
      if (action.type === 'pasteRange' && selectedCell && clipboardRef.current) {
        pushHistory(sheets);
        const newGrid = activeSheet.grid.map((row, ri) =>
          row.map((cell, ci) =>
            ri === selectedCell.row && ci === selectedCell.col
              ? { ...clipboardRef.current!, row: ri, col: ci }
              : cell
          )
        );
        onSheetReplace(activeSheetIdx, { ...activeSheet, grid: newGrid });
        return;
      }

      // ── Sort / Filter ────────────────────────────────────────
      if (action.type === 'sortColumn' && selectedCell) {
        pushHistory(sheets);
        const sortedRows = [...activeSheet.grid].sort((rowA, rowB) => {
          const a = String(rowA[selectedCell.col]?.value ?? '');
          const b = String(rowB[selectedCell.col]?.value ?? '');
          return action.direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
        });
        onSheetReplace(activeSheetIdx, { ...activeSheet, grid: sortedRows });
        return;
      }

      // ── Formula / Function ──────────────────────────────────
      if (action.type === 'formula' && selectedCell) {
        onCellChange(activeSheetIdx, selectedCell.row, selectedCell.col, {
          ...(activeSheet.grid[selectedCell.row]?.[selectedCell.col] || { row: selectedCell.row, col: selectedCell.col, type: 'formula', value: '' }),
          type: 'formula', value: action.value,
        });
        return;
      }
      if (action.type === 'insertFunction' && selectedCell) {
        const nextFormula = `=${action.name.toUpperCase()}()`;
        onCellChange(activeSheetIdx, selectedCell.row, selectedCell.col, {
          ...(activeSheet.grid[selectedCell.row]?.[selectedCell.col] || { row: selectedCell.row, col: selectedCell.col, type: 'formula', value: '' }),
          type: 'formula', value: nextFormula,
        });
        setEditValue(nextFormula);
        return;
      }
      if (action.type === 'autoFunction' && selectedCell) {
        const rangeA1 = getSelectedA1Range() || `${toColName(selectedCell.col)}${selectedCell.row + 1}`;
        const nextFormula = `=${action.name}(${rangeA1})`;
        onCellChange(activeSheetIdx, selectedCell.row, selectedCell.col, {
          ...(activeSheet.grid[selectedCell.row]?.[selectedCell.col] || { row: selectedCell.row, col: selectedCell.col, type: 'formula', value: '' }),
          type: 'formula', value: nextFormula,
        });
        setEditValue(nextFormula);
        return;
      }

      if (action.type === 'formatPainter') return;

      // ── Range-based formatting ────────────────────────────────
      if (!selectedCell) return;

      const minRow = selectedRange ? Math.min(selectedRange.start.row, selectedRange.end.row) : selectedCell.row;
      const maxRow = selectedRange ? Math.max(selectedRange.start.row, selectedRange.end.row) : selectedCell.row;
      const minCol = selectedRange ? Math.min(selectedRange.start.col, selectedRange.end.col) : selectedCell.col;
      const maxCol = selectedRange ? Math.max(selectedRange.start.col, selectedRange.end.col) : selectedCell.col;

      let updatedGrid = [...activeSheet.grid];
      let changed = false;

      for (let r = minRow; r <= maxRow; r++) {
        const row = [...updatedGrid[r]];
        for (let c = minCol; c <= maxCol; c++) {
          const cell = row[c];
          if (!cell) continue;
          let newCell = { ...cell };
          changed = true;

          if (action.type === 'mergeCell')   newCell.merged = true;
          if (action.type === 'unmergeCell') { newCell.merged = false; newCell.colSpan = undefined; newCell.rowSpan = undefined; }
          if (action.type === 'clearCell')   { newCell.value = ''; newCell.type = 'empty'; }
          if (action.type === 'textColor')       newCell.textColor = action.value;
          if (action.type === 'backgroundColor') newCell.backgroundColor = action.value;
          if (action.type === 'bold' || action.type === 'italic' || action.type === 'underline') newCell[action.type] = !newCell[action.type];
          if (action.type === 'alignCell')    newCell.align = action.value;
          if (action.type === 'numberFormat') newCell.numberFormat = action.value;
          if (action.type === 'fontSizeCell') newCell.fontSize = action.value;
          if (action.type === 'fontNameCell') newCell.fontName = action.value;
          if (action.type === 'wrapText')     newCell.wrapText = !newCell.wrapText;

          row[c] = newCell;
        }
        updatedGrid[r] = row;
      }

      if (changed) {
        onSheetReplace(activeSheetIdx, { ...activeSheet, grid: updatedGrid });
      }
    },
  }), [selectedCell, selectedRange, activeSheet, activeSheetIdx, onCellChange, onSheetReplace, sheets, pushHistory]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editCell) {
      if (e.key === 'Enter') handleCellSave();
      else if (e.key === 'Escape') setEditCell(null);
    } else {
      if (!selectedCell) return;
      const rows = activeSheet.grid.length;
      const cols = activeSheet.grid[0]?.length || 0;
      let { row, col } = selectedCell;

      if (e.key === 'F2' || e.key === 'Enter') {
        e.preventDefault();
        setEditCell({ row, col });
        setEditValue(String(activeSheet.grid[row][col]?.value || ''));
        return;
      }
      if (e.key === 'ArrowUp') row = Math.max(0, row - 1);
      else if (e.key === 'ArrowDown') row = Math.min(rows - 1, row + 1);
      else if (e.key === 'ArrowLeft') col = Math.max(0, col - 1);
      else if (e.key === 'ArrowRight') col = Math.min(cols - 1, col + 1);
      else return;

      e.preventDefault();
      setSelectedCell({ row, col });
      setSelectedRange({ start: { row, col }, end: { row, col } });
      setEditValue(String(activeSheet.grid[row][col]?.value || ''));
    }
  };

  if (!activeSheet) {
    return <div className={styles.container}>No sheets available</div>;
  }

  return (
    <div className={styles.container}>
      {/* Formula Input Bar */}
      <div className={styles.formulaBar}>
        <div className={styles.cellRefDisplay}>
          {selectedCell ? `${String.fromCharCode(65 + selectedCell.col)}${selectedCell.row + 1}` : ''}
        </div>
        <div className={styles.formulaIcon}>fx</div>
        <input
          type="text"
          className={styles.formulaInput}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCellSave();
          }}
          placeholder="수식 입력..."
        />
      </div>

      {/* Grid */}
      <div
        className={styles.gridContainer}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{ outline: 'none' }}
      >
        <table className={styles.grid}>
          <thead>
            <tr>
              <th className={styles.colHeader}></th>
              {activeSheet.grid[0]?.map((_, colIdx) => (
                <th key={colIdx} className={styles.colHeader}>
                  {String.fromCharCode(65 + colIdx)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeSheet.grid.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {/* Row number */}
                <td className={styles.rowHeader}>{rowIdx + 1}</td>

                {row.map((cell, colIdx) => {
                  const isSelected = selectedRange &&
                    rowIdx >= Math.min(selectedRange.start.row, selectedRange.end.row) &&
                    rowIdx <= Math.max(selectedRange.start.row, selectedRange.end.row) &&
                    colIdx >= Math.min(selectedRange.start.col, selectedRange.end.col) &&
                    colIdx <= Math.max(selectedRange.start.col, selectedRange.end.col);

                  const isPrimarySelect = selectedCell?.row === rowIdx && selectedCell?.col === colIdx;

                  return (
                    <td
                      key={`${rowIdx}-${colIdx}`}
                      className={`${styles.gridCell} ${isSelected ? styles.selectedRange : ''} ${isPrimarySelect ? styles.selected : ''}`}
                      onPointerDown={() => handlePointerDown(rowIdx, colIdx, cell.value)}
                      onPointerEnter={() => handlePointerEnter(rowIdx, colIdx)}
                      onDoubleClick={() => setEditCell({ row: rowIdx, col: colIdx })}
                      style={{
                        fontWeight: cell.bold ? 'bold' : 'normal',
                        fontStyle: cell.italic ? 'italic' : 'normal',
                        textDecoration: cell.underline ? 'underline' : 'none',
                        color: cell.textColor || 'inherit',
                        backgroundColor: cell.backgroundColor || undefined,
                        textAlign: cell.align || 'left',
                        fontSize: cell.fontSize ? `${cell.fontSize}pt` : undefined,
                        fontFamily: cell.fontName || undefined,
                        whiteSpace: cell.wrapText ? 'pre-wrap' : 'nowrap',
                        overflow: cell.wrapText ? 'visible' : 'hidden',
                        textOverflow: cell.wrapText ? undefined : 'ellipsis',
                      }}
                    >
                      {editCell?.row === rowIdx && editCell?.col === colIdx ? (
                        <input
                          type="text"
                          className={styles.cellInput}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellSave}
                          autoFocus
                        />
                      ) : (
                        <span>{String(cell.value).startsWith('=') ? String(evaluateFormula(String(cell.value), activeSheet.grid)) : cell.value}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sheet Tabs Bottom */}
      <div className={styles.bottomSheetBar}>
        <div className={styles.sheetTabs}>
          {sheets.filter(s => s.name !== '__DELETE__').map((sheet, idx) => (
            <button
              key={idx}
              className={`${styles.sheetTab} ${activeSheetIdx === idx ? styles.active : ''}`}
              onClick={() => setActiveSheetIdx(idx)}
              onDoubleClick={() => {
                const newName = prompt('새 시트 이름:', sheet.name);
                if (newName) onSheetReplace(idx, { ...sheet, name: newName });
              }}
            >
              {sheet.name || `Sheet ${idx + 1}`}
            </button>
          ))}
        </div>
        <button className={styles.addSheetBtn} onClick={() => {
          const newIdx = sheets.length;
          const cols = activeSheet.grid[0]?.length || 10;
          const rows = activeSheet.grid.length || 20;
          const newGrid = Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => ({ row: r, col: c, type: 'string' as const, value: '' }))
          );
          onSheetReplace(newIdx, { sheetIndex: newIdx, name: `Sheet${newIdx + 1}`, rowCount: rows, columnCount: cols, grid: newGrid });
          setActiveSheetIdx(newIdx);
        }}>+</button>
      </div>
    </div>
  );
});

export default SpreadsheetGrid;
