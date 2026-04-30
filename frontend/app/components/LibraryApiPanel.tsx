'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

type LibraryName = 'hwplib' | 'hwpxlib' | 'poi';

interface LibrarySummary {
  library: LibraryName;
  classCount: number;
  methodCount: number;
}

interface RequiredValidation {
  library: LibraryName;
  className: string;
  methodName: string;
  exists: boolean;
}

interface MatchEntry {
  library: LibraryName;
  className: string;
  matchedMethodCount: number;
  methods?: string[];
}

interface CatalogResponse {
  generatedAt: string;
  libraries: LibrarySummary[];
  requiredApiValidation: RequiredValidation[];
  matches?: MatchEntry[];
  error?: string;
}

interface LibraryApiPanelProps {
  token?: string;
}

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 8px',
  borderRadius: '999px',
  fontSize: '11px',
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.04)',
};

export default function LibraryApiPanel({ token }: LibraryApiPanelProps) {
  const [loading, setLoading] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLibrary, setSelectedLibrary] = useState<'all' | LibraryName>('all');
  const [keyword, setKeyword] = useState('');
  const [summary, setSummary] = useState<CatalogResponse | null>(null);
  const [matches, setMatches] = useState<MatchEntry[]>([]);

  const fetchCatalog = useCallback(async (refresh: boolean, nextKeyword?: string) => {
    if (!token) return;

    const isSearch = Boolean(nextKeyword && nextKeyword.trim());
    if (isSearch) setQuerying(true);
    else setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedLibrary !== 'all') params.set('library', selectedLibrary);
      if (nextKeyword && nextKeyword.trim()) params.set('keyword', nextKeyword.trim());
      params.set('includeMethods', 'true');
      params.set('maxMatches', '80');

      const endpoint = refresh
        ? `/api/documents/library-apis/refresh?${params.toString()}`
        : `/api/documents/library-apis?${params.toString()}`;

      const res = await fetch(endpoint, {
        method: refresh ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`API catalog request failed: ${res.status}`);
      }

      const data = (await res.json()) as CatalogResponse;
      if (data.error) {
        throw new Error(data.error);
      }

      setSummary(data);
      setMatches(data.matches ?? []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
      setQuerying(false);
    }
  }, [selectedLibrary, token]);

  useEffect(() => {
    fetchCatalog(false);
  }, [fetchCatalog]);

  const missingRequired = useMemo(
    () => (summary?.requiredApiValidation ?? []).filter((entry) => !entry.exists),
    [summary],
  );

  return (
    <section style={{
      margin: '10px 20px 0',
      borderRadius: '14px',
      border: '1px solid rgba(56,189,248,0.22)',
      background: 'linear-gradient(180deg, rgba(10,18,28,0.96), rgba(10,18,28,0.88))',
      color: '#dbeafe',
      padding: '12px 14px',
      display: 'grid',
      gap: '10px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#7dd3fc', fontWeight: 700 }}>라이브러리 API 검증</div>
          <div style={{ fontSize: '11px', color: '#93c5fd', marginTop: '4px' }}>
            hwplib, hwpxlib, Apache POI의 실제 클래스/함수명을 클래스패스에서 직접 스캔합니다.
          </div>
        </div>
        <button
          onClick={() => fetchCatalog(true, keyword)}
          disabled={!token || loading || querying}
          style={{
            border: '1px solid rgba(56,189,248,0.35)',
            background: 'rgba(56,189,248,0.15)',
            color: '#dbeafe',
            borderRadius: '10px',
            fontSize: '12px',
            padding: '7px 10px',
            cursor: 'pointer',
          }}
        >
          카탈로그 새로고침
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <select
          value={selectedLibrary}
          onChange={(e) => setSelectedLibrary(e.target.value as 'all' | LibraryName)}
          style={{
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(15,23,42,0.88)',
            color: '#e2e8f0',
            padding: '7px 10px',
            fontSize: '12px',
          }}
        >
          <option value="all">전체 라이브러리</option>
          <option value="hwplib">hwplib</option>
          <option value="hwpxlib">hwpxlib</option>
          <option value="poi">Apache POI</option>
        </select>

        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="함수명/클래스명 검색 (예: toBytes, XWPFDocument)"
          style={{
            minWidth: '260px',
            flex: '1 1 260px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(15,23,42,0.88)',
            color: '#e2e8f0',
            padding: '7px 10px',
            fontSize: '12px',
          }}
        />

        <button
          onClick={() => fetchCatalog(false, keyword)}
          disabled={!token || querying}
          style={{
            border: '1px solid rgba(148,163,184,0.35)',
            background: 'rgba(148,163,184,0.14)',
            color: '#e2e8f0',
            borderRadius: '10px',
            fontSize: '12px',
            padding: '7px 10px',
            cursor: 'pointer',
          }}
        >
          검색
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: '12px', color: '#93c5fd' }}>라이브러리 API 카탈로그를 불러오는 중...</div>
      ) : null}

      {error ? (
        <div style={{ fontSize: '12px', color: '#fca5a5' }}>오류: {error}</div>
      ) : null}

      {summary && (
        <>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {summary.libraries.map((lib) => (
              <div
                key={lib.library}
                style={{
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.03)',
                  padding: '8px 10px',
                }}
              >
                <div style={{ fontSize: '11px', color: '#7dd3fc', textTransform: 'uppercase' }}>{lib.library}</div>
                <div style={{ fontSize: '12px', color: '#e2e8f0', marginTop: '4px' }}>클래스 {lib.classCount.toLocaleString()}</div>
                <div style={{ fontSize: '12px', color: '#e2e8f0' }}>함수 {lib.methodCount.toLocaleString()}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={chipStyle}>검증 시각 {new Date(summary.generatedAt).toLocaleString()}</span>
            <span style={{
              ...chipStyle,
              borderColor: missingRequired.length === 0 ? 'rgba(34,197,94,0.4)' : 'rgba(248,113,113,0.4)',
              background: missingRequired.length === 0 ? 'rgba(34,197,94,0.14)' : 'rgba(248,113,113,0.14)',
              color: missingRequired.length === 0 ? '#86efac' : '#fecaca',
            }}>
              {missingRequired.length === 0 ? '필수 API 검증 통과' : `누락 필수 API ${missingRequired.length}건`}
            </span>
          </div>

          {missingRequired.length > 0 && (
            <div style={{
              padding: '10px',
              borderRadius: '10px',
              border: '1px solid rgba(248,113,113,0.35)',
              background: 'rgba(127,29,29,0.22)',
              fontSize: '12px',
              color: '#fecaca',
              display: 'grid',
              gap: '4px',
            }}>
              {missingRequired.map((m) => (
                <div key={`${m.library}:${m.className}:${m.methodName}`}>
                  [{m.library}] {m.className}#{m.methodName}
                </div>
              ))}
            </div>
          )}

          {matches.length > 0 && (
            <div style={{
              marginTop: '2px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.03)',
              maxHeight: '280px',
              overflow: 'auto',
              padding: '10px',
              display: 'grid',
              gap: '8px',
            }}>
              {matches.map((match) => (
                <div key={`${match.library}:${match.className}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#7dd3fc' }}>{match.library}</div>
                  <div style={{ fontSize: '12px', color: '#e2e8f0', marginTop: '2px' }}>{match.className}</div>
                  <div style={{ fontSize: '11px', color: '#93c5fd', marginTop: '4px' }}>일치 메서드 {match.matchedMethodCount}개</div>
                  {match.methods && match.methods.length > 0 && (
                    <div style={{ marginTop: '4px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {match.methods.slice(0, 18).map((method) => (
                        <span key={`${match.className}:${method}`} style={chipStyle}>{method}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
