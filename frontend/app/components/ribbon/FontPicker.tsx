'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BUILTIN_FONTS, FontEntry, loadGoogleFont, searchGoogleFonts, GoogleFontItem } from '../../utils/fonts';

interface FontPickerProps {
  value: string;
  onChange: (family: string) => void;
  /** Optional: only show these categories */
  categories?: FontEntry['category'][];
}

const CATEGORIES: { key: FontEntry['category'] | 'all'; label: string }[] = [
  { key: 'all',        label: '전체' },
  { key: 'korean',     label: '한국어' },
  { key: 'latin',      label: 'Latin' },
  { key: 'display',    label: '디스플레이' },
  { key: 'handwriting',label: '손글씨' },
  { key: 'monospace',  label: '코드' },
];

export default function FontPicker({ value, onChange, categories }: FontPickerProps) {
  const [open,         setOpen]         = useState(false);
  const [query,        setQuery]        = useState('');
  const [activeTab,    setActiveTab]    = useState<FontEntry['category'] | 'all'>('all');
  const [googleResults,setGoogleResults]= useState<GoogleFontItem[]>([]);
  const [searching,    setSearching]    = useState(false);
  const containerRef   = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Debounced Google Fonts search
  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setGoogleResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const results = await searchGoogleFonts(q, 30);
      setGoogleResults(results);
      setSearching(false);
    }, 400);
  }, []);

  // Filtered built-in list
  const filtered = BUILTIN_FONTS.filter(f => {
    const matchCat = activeTab === 'all' || f.category === activeTab;
    const matchCatFilter = !categories || categories.includes(f.category);
    const matchQ = !query || f.label.toLowerCase().includes(query.toLowerCase()) || f.family.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchCatFilter && matchQ;
  });

  const handleSelect = (family: string) => {
    loadGoogleFont(family);
    onChange(family);
    setOpen(false);
    setQuery('');
    setGoogleResults([]);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          fontFamily: value,
          minWidth: '140px',
          maxWidth: '200px',
          padding: '4px 8px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '6px',
          color: '#e2e8f0',
          fontSize: '13px',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '4px',
          transition: 'border-color 0.15s',
        }}
        title={value}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{value}</span>
        <span style={{ fontSize: '10px', opacity: 0.5 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          zIndex: 10000,
          width: '320px',
          background: '#1a1b2e',
          border: '1px solid rgba(122,162,247,0.25)',
          borderRadius: '10px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          animation: 'popIn 0.15s ease',
        }}>
          {/* Search bar */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => handleSearch(e.target.value)}
              placeholder="폰트 검색 (한글/영문, Google Fonts 포함)..."
              style={{
                width: '100%',
                padding: '6px 10px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(122,162,247,0.3)',
                borderRadius: '6px',
                color: '#e2e8f0',
                fontSize: '12px',
                outline: 'none',
              }}
            />
            {searching && (
              <div style={{ fontSize: '11px', color: '#7aa2f7', marginTop: '4px', paddingLeft: '2px' }}>
                Google Fonts 검색 중...
              </div>
            )}
          </div>

          {/* Category tabs */}
          <div style={{ display: 'flex', gap: '2px', padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => (
              <button key={cat.key} onClick={() => setActiveTab(cat.key as FontEntry['category'] | 'all')}
                style={{
                  padding: '2px 8px', borderRadius: '12px', fontSize: '11px', cursor: 'pointer',
                  border: 'none', transition: 'all 0.15s',
                  background: activeTab === cat.key ? '#7aa2f7' : 'rgba(255,255,255,0.06)',
                  color: activeTab === cat.key ? '#1a1b2e' : '#a9b1d6',
                  fontWeight: activeTab === cat.key ? 600 : 400,
                }}>
                {cat.label}
              </button>
            ))}
          </div>

          {/* Font list */}
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {/* Google Fonts search results (top priority when searching) */}
            {googleResults.length > 0 && (
              <>
                <div style={{ padding: '6px 12px 2px', fontSize: '10px', color: '#7aa2f7', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Google Fonts 검색 결과
                </div>
                {googleResults.map(f => (
                  <FontRow key={'gf-' + f.family} family={f.family} isSelected={value === f.family}
                    isGoogle onSelect={handleSelect} />
                ))}
                <div style={{ margin: '4px 12px', borderTop: '1px solid rgba(255,255,255,0.07)' }} />
              </>
            )}

            {/* Built-in / preloaded fonts */}
            {!query && (
              <div style={{ padding: '6px 12px 2px', fontSize: '10px', color: '#7aa2f7', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                기본 탑재 폰트
              </div>
            )}
            {filtered.map(f => (
              <FontRow key={f.family} family={f.family} label={f.label}
                isSelected={value === f.family} onSelect={handleSelect} />
            ))}
            {filtered.length === 0 && googleResults.length === 0 && !searching && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#565f89', fontSize: '12px' }}>
                결과가 없습니다
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── FontRow sub-component ─────────────────────────────────────────────── */
interface FontRowProps {
  family: string;
  label?: string;
  isSelected: boolean;
  isGoogle?: boolean;
  onSelect: (family: string) => void;
}

function FontRow({ family, label, isSelected, isGoogle, onSelect }: FontRowProps) {
  return (
    <button
      onClick={() => onSelect(family)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '6px 12px',
        background: isSelected ? 'rgba(122,162,247,0.15)' : 'transparent',
        border: 'none',
        borderLeft: isSelected ? '2px solid #7aa2f7' : '2px solid transparent',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(122,162,247,0.08)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isSelected ? 'rgba(122,162,247,0.15)' : 'transparent'; }}
    >
      <div>
        <div style={{ fontFamily: family, fontSize: '14px', color: '#e2e8f0', lineHeight: 1.3 }}>
          {label || family}
        </div>
        <div style={{ fontFamily: family, fontSize: '10px', color: '#565f89', lineHeight: 1 }}>
          The quick brown fox / 가나다라마바사
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        {isGoogle && (
          <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '8px', background: 'rgba(66,133,244,0.2)', color: '#7aa2f7' }}>
            Google
          </span>
        )}
        {isSelected && <span style={{ fontSize: '12px', color: '#7aa2f7' }}>✓</span>}
      </div>
    </button>
  );
}
