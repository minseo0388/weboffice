'use client';

import React, { useState, useRef, useEffect } from 'react';

interface FontSizePickerProps {
  value: number;
  onChange: (size: number) => void;
  presets?: number[];
}

const DEFAULT_PRESETS = [
  6, 7, 8, 9, 10, 10.5, 11, 12, 13, 14, 15, 16, 18, 20, 22,
  24, 26, 28, 32, 36, 40, 48, 54, 60, 72, 80, 96,
];

export default function FontSizePicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
}: FontSizePickerProps) {
  const [open,     setOpen]     = useState(false);
  const [inputVal, setInputVal] = useState(String(value));
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  // Sync inputVal when value changes from outside
  useEffect(() => { setInputVal(String(value)); }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const commit = (raw: string) => {
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0 && n <= 400) {
      onChange(n);
      setInputVal(String(n));
    } else {
      setInputVal(String(value)); // revert
    }
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {/* Direct input */}
      <input
        ref={inputRef}
        type="text"
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter')  { commit(inputVal); inputRef.current?.blur(); }
          if (e.key === 'Escape') { setInputVal(String(value)); setOpen(false); inputRef.current?.blur(); }
          if (e.key === 'ArrowUp')   { const n = parseFloat(inputVal) + 1; setInputVal(String(n)); onChange(n); e.preventDefault(); }
          if (e.key === 'ArrowDown') { const n = Math.max(1, parseFloat(inputVal) - 1); setInputVal(String(n)); onChange(n); e.preventDefault(); }
        }}
        style={{
          width: '44px',
          padding: '3px 6px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '6px 0 0 6px',
          color: '#e2e8f0',
          fontSize: '12px',
          textAlign: 'right',
          outline: 'none',
          cursor: 'text',
        }}
      />

      {/* Dropdown toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          padding: '3px 5px',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderLeft: 'none',
          borderRadius: '0 6px 6px 0',
          color: '#a9b1d6',
          fontSize: '9px',
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >
        {open ? '▲' : '▼'}
      </button>

      {/* Preset dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 2px)',
          right: 0,
          zIndex: 10001,
          background: '#1a1b2e',
          border: '1px solid rgba(122,162,247,0.25)',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          minWidth: '70px',
          maxHeight: '260px',
          overflowY: 'auto',
        }}>
          {presets.map(size => (
            <button
              key={size}
              onClick={() => { onChange(size); setInputVal(String(size)); setOpen(false); }}
              style={{
                display: 'block',
                width: '100%',
                padding: '5px 12px',
                textAlign: 'right',
                background: value === size ? 'rgba(122,162,247,0.15)' : 'transparent',
                border: 'none',
                borderLeft: value === size ? '2px solid #7aa2f7' : '2px solid transparent',
                color: value === size ? '#7aa2f7' : '#e2e8f0',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: value === size ? 600 : 400,
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(122,162,247,0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = value === size ? 'rgba(122,162,247,0.15)' : 'transparent'; }}
            >
              {size}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
