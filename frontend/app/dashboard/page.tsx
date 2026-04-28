'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import styles from './dashboard.module.css';

interface FileItem {
  name: string;
}

interface StorageUsage {
  usedBytes: number;
  fileCount: number;
  usedFormatted: string;
  quotaBytes?: number;
  quotaFormatted?: string;
  usagePercent?: number;
}

interface LinkedIdentity {
  sub?: string;
  email?: string;
  name?: string;
  id?: string;
  username?: string;
}

interface AccountInfo {
  accountId: string;
  google: LinkedIdentity;
  discord: LinkedIdentity;
  createdAt?: string;
}

const DEFAULT_MAX_BYTES = 3 * 1024 * 1024 * 1024; // 3 GB default

function getIcon(name: string): string {
  if (name.endsWith('.hwpx')) return '📘';
  if (name.endsWith('.hwp'))  return '📄';
  if (name.endsWith('.xlsx') || name.endsWith('.xls'))  return '📊';
  if (name.endsWith('.docx') || name.endsWith('.doc'))  return '📝';
  return '📎';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)              return `${bytes} B`;
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)        return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export default function DashboardMain() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [files, setFiles]         = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [usage, setUsage]         = useState<StorageUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);

  const authHeader = { Authorization: `Bearer ${user?.token}` } as const;

  // ── Fetch file list ──────────────────────────────────────────────────────────
  const fetchFiles = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/storage/files', { headers: authHeader });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json() as { files: string[] };
      setFiles(data.files.map((name) => ({ name })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // ── Fetch REAL storage usage from OCI via /api/storage/usage ─────────────────
  const fetchUsage = useCallback(async () => {
    if (!user) return;
    setUsageLoading(true);
    try {
      const res = await fetch('/api/storage/usage', { headers: authHeader });
      if (!res.ok) throw new Error('Usage fetch failed');
      const data = await res.json() as StorageUsage;
      setUsage(data);
    } catch {
      // Non-fatal: leave usage as null (shows "—")
    } finally {
      setUsageLoading(false);
    }
  }, [user]);

  // ── Fetch account linking info ────────────────────────────────────────────
  const fetchAccountInfo = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/account/me', { headers: authHeader });
      if (res.ok) setAccountInfo(await res.json() as AccountInfo);
    } catch { /* non-fatal */ }
  }, [user]);

  useEffect(() => {
    if (!user) { router.replace('/'); return; }
    fetchFiles();
    fetchUsage();
    fetchAccountInfo();

    // Check if we're returning from a link OAuth2 flow
    const pendingLinkCode = sessionStorage.getItem('pendingLinkCode');
    const pendingProvider = sessionStorage.getItem('pendingLinkProvider');
    if (pendingLinkCode && pendingProvider && user.token) {
      sessionStorage.removeItem('pendingLinkCode');
      sessionStorage.removeItem('pendingLinkProvider');
      completeLinking(pendingLinkCode, user.token);
    }
  }, [user, fetchFiles, fetchUsage, fetchAccountInfo, router]);

  const completeLinking = async (linkCode: string, token: string) => {
    try {
      const res = await fetch('/api/account/link/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ linkCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setLinkMessage('✅ 계정 연결 완료! 변경사항을 반영하려면 다시 로그인해주세요.');
        fetchAccountInfo();
      } else {
        setLinkMessage('❌ 계정 연결 실패: ' + (data.error ?? '알 수 없는 오류'));
      }
    } catch {
      setLinkMessage('❌ 계정 연결 중 오류가 발생했습니다.');
    }
  };

  const handleLinkProvider = async (targetProvider: string) => {
    if (!user) return;
    setLinkingProvider(targetProvider);
    try {
      const res = await fetch(`/api/account/link/start?targetProvider=${targetProvider}`, {
        method: 'POST',
        headers: authHeader,
      });
      const data = await res.json();
      if (!res.ok) {
        setLinkMessage('❌ ' + (data.error ?? '연결 시작 실패'));
        setLinkingProvider(null);
        return;
      }
      // Store link code and navigate to OAuth2 flow
      sessionStorage.setItem('pendingLinkCode', data.linkCode);
      sessionStorage.setItem('pendingLinkProvider', targetProvider);
      window.location.href = data.redirectUrl;
    } catch {
      setLinkMessage('❌ 계정 연결 요청 중 오류가 발생했습니다.');
      setLinkingProvider(null);
    }
  };

  // ── Upload ────────────────────────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: authHeader,
        body: form,
      });
      if (!res.ok) throw new Error('Upload failed');
      await Promise.all([fetchFiles(), fetchUsage()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const handleDelete = async (fileName: string) => {
    if (!user || !confirm(`"${fileName}" 을 삭제하시겠습니까?`)) return;
    try {
      await fetch(`/api/storage/delete/${encodeURIComponent(fileName)}`, {
        method: 'DELETE',
        headers: authHeader,
      });
      await Promise.all([fetchFiles(), fetchUsage()]);
    } catch {
      setError('삭제에 실패했습니다.');
    }
  };

  if (!user) return null;

  const isUnlimited = usage?.quotaBytes === -1;
  const effectiveQuotaBytes = isUnlimited ? Infinity : (usage?.quotaBytes ?? DEFAULT_MAX_BYTES);
  const usagePct = isUnlimited
    ? 0
    : (usage?.usagePercent ?? (usage
        ? Math.min((usage.usedBytes / effectiveQuotaBytes) * 100, 100)
        : 0));

  const maxFormatted = isUnlimited ? '무제한' : (usage?.quotaFormatted ?? formatBytes(DEFAULT_MAX_BYTES));

  return (
    <div className={styles.container}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.logoGroup}>
          <div className={styles.sphere} />
          <h1>naesungOffice</h1>
        </div>
        <div className={styles.userBar}>
          <div className={styles.providerBadge}>
            {user.provider === 'google' ? '🔵 Google' : '🟣 Discord'}
          </div>
          <span className={styles.userName}>{user.name}</span>
          <button className={styles.logoutBtn} onClick={logout}>로그아웃</button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className={styles.body}>
        {/* ── Sidebar ── */}
        <aside className={styles.sidebar}>
          <nav className={styles.nav}>
            <button className={`${styles.navItem} ${styles.active}`}>
              <span>📁</span> 내 드라이브
            </button>
            <button className={styles.navItem}>
              <span>⭐</span> 즐겨찾기
            </button>
            <button className={styles.navItem}>
              <span>🕒</span> 최근 문서
            </button>
          </nav>

          {/* ── Real Storage Widget ── */}
          <div className={styles.storageInfo}>
            <p className={styles.storageLabel}>저장 공간</p>
            <div className={styles.storageBar}>
              <div
                className={styles.storageFill}
                style={{ width: usageLoading ? '0%' : `${usagePct.toFixed(1)}%` }}
              />
            </div>
            {usageLoading ? (
              <p className={styles.storageText}>조회 중...</p>
            ) : usage ? (
              <>
                <p className={styles.storageText}>
                  {usage.usedFormatted} / {maxFormatted} 사용
                </p>
                <p className={styles.storageCount}>
                  파일 {usage.fileCount.toLocaleString()}개
                </p>
              </>
            ) : (
              <p className={styles.storageText}>—</p>
            )}
          </div>

          {/* ── Account Linking Widget ── */}
          <div className={styles.accountLinking}>
            <p className={styles.storageLabel}>연결된 계정</p>

            {linkMessage && (
              <p className={styles.linkMessage}>{linkMessage}</p>
            )}

            {/* Google */}
            <div className={styles.linkedRow}>
              <span className={styles.linkedIcon}>🔵</span>
              <div className={styles.linkedInfo}>
                <span className={styles.linkedProvider}>Google</span>
                {accountInfo?.google?.email ? (
                  <span className={styles.linkedEmail}>{accountInfo.google.email}</span>
                ) : (
                  <span className={styles.linkedNone}>미연결</span>
                )}
              </div>
              {!accountInfo?.google?.email && user.provider !== 'google' && (
                <button
                  className={styles.linkBtn}
                  onClick={() => handleLinkProvider('google')}
                  disabled={linkingProvider !== null}
                >
                  {linkingProvider === 'google' ? '연결 중...' : '연결'}
                </button>
              )}
            </div>

            {/* Discord */}
            <div className={styles.linkedRow}>
              <span className={styles.linkedIcon}>🟣</span>
              <div className={styles.linkedInfo}>
                <span className={styles.linkedProvider}>Discord</span>
                {accountInfo?.discord?.username ? (
                  <span className={styles.linkedEmail}>{accountInfo.discord.username}</span>
                ) : (
                  <span className={styles.linkedNone}>미연결</span>
                )}
              </div>
              {!accountInfo?.discord?.id && user.provider !== 'discord' && (
                <button
                  className={styles.linkBtn}
                  onClick={() => handleLinkProvider('discord')}
                  disabled={linkingProvider !== null}
                >
                  {linkingProvider === 'discord' ? '연결 중...' : '연결'}
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className={styles.main}>
          <div className={styles.toolbar}>
            <div>
              <h2>내 문서</h2>
              {!isLoading && (
                <p className={styles.fileCountHint}>
                  {files.length}개 파일
                </p>
              )}
            </div>
            <label className={styles.uploadBtn}>
              {uploading ? '업로드 중...' : '+ HWP/HWPX 업로드'}
              <input
                type="file"
                accept=".hwp,.hwpx,.doc,.docx,.xlsx"
                onChange={handleUpload}
                hidden
              />
            </label>
          </div>

          {error && <div className={styles.errorBanner}>{error}</div>}

          {isLoading ? (
            <div className={styles.loadingGrid}>
              {[...Array(6)].map((_, i) => (
                <div key={i} className={styles.skeleton} />
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className={styles.empty}>
              <p>📂 아직 업로드된 문서가 없습니다.</p>
              <p>위 버튼으로 HWP/HWPX 파일을 업로드하세요.</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {files.map((f) => (
                <div
                  key={f.name}
                  className={styles.card}
                  onClick={() => router.push(`/editor?file=${encodeURIComponent(f.name)}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && router.push(`/editor?file=${encodeURIComponent(f.name)}`)}
                >
                  <div className={styles.cardIcon}>{getIcon(f.name)}</div>
                  <p className={styles.cardName}>{f.name}</p>
                  <div className={styles.cardActions}>
                    <a
                      href={`/api/storage/download/${encodeURIComponent(f.name)}`}
                      onClick={(e) => e.stopPropagation()}
                      className={styles.actionBtn}
                      title="다운로드"
                    >
                      ⬇
                    </a>
                    <button
                      className={`${styles.actionBtn} ${styles.deleteBtn}`}
                      onClick={(e) => { e.stopPropagation(); handleDelete(f.name); }}
                      title="삭제"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
