'use client';

import styles from './page.module.css';

export default function LandingPage() {
  const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

  return (
    <div className={styles.container}>
      <nav className={styles.navbar}>
        <div className={styles.logoGroup}>
          <div className={styles.logoMark} />
          <span className={styles.logoText}>Hangul Cloud</span>
        </div>
        <div className={styles.navLinks}>
          <a href="#features">Features</a>
          <a href="#security">Security</a>
        </div>
      </nav>

      <main className={styles.mainGrid}>
        <section className={styles.heroText}>
          <div className={styles.badge}>Next-Gen Editor ✨</div>
          <h1 className={styles.heroTitle}>
            Your Personal <br />
            <span className={styles.heroGradient}>Workspace</span>
          </h1>
          <p className={styles.subtitle}>
            HWP/HWPX 웹 에디터. 언제 어디서나 브라우저에서 문서를 편집하고
            개인 오브젝트 스토리지에 안전하게 보관하세요.
          </p>

          <section className={styles.authContainer}>
            <p className={styles.authLabel}>Get Started Securely:</p>

            <div className={styles.loginButtons}>
              <a className={`${styles.btn} ${styles.googleBtn}`} href={`${backendBaseUrl}/oauth2/authorization/google`}>
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path d="M44.5 20H24v8h11.7C34.3 33.3 29.6 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-9 20-20 0-1.3-.2-2.7-.5-4z" fill="#FFC107" />
                  <path d="M6.3 14.7l6.6 4.8C14.5 16.1 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" fill="#FF3D00" />
                  <path d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.6 0-10.3-3.7-11.7-8.8L6.3 32C9.8 39.3 16.4 44 24 44z" fill="#4CAF50" />
                  <path d="M44.5 20H24v8h11.7c-.6 2-1.9 3.8-3.7 5.1l6.2 5.2C42 35 44.5 30 44.5 24c0-1.3-.2-2.7-.5-4z" fill="#1976D2" />
                </svg>
                Google로 로그인
              </a>

              <a className={`${styles.btn} ${styles.discordBtn}`} href={`${backendBaseUrl}/oauth2/authorization/discord`}>
                <svg width="22" height="22" viewBox="0 0 71 55" fill="none">
                  <path d="M60.1 4.9A58.5 58.5 0 0 0 45.5.4a.2.2 0 0 0-.2.1 40.7 40.7 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0A37.6 37.6 0 0 0 25.4.5a.2.2 0 0 0-.2-.1A58.4 58.4 0 0 0 10.6 4.9a.2.2 0 0 0-.1.1C1.6 18.1-.9 31 .3 43.7a.2.2 0 0 0 .1.1 58.8 58.8 0 0 0 17.7 9 .2.2 0 0 0 .2-.1 42 42 0 0 0 3.6-5.9.2.2 0 0 0-.1-.3 38.7 38.7 0 0 1-5.5-2.6.2.2 0 0 1 0-.3l1.1-.9a.2.2 0 0 1 .2 0c11.5 5.3 24 5.3 35.4 0a.2.2 0 0 1 .2 0l1.1.9a.2.2 0 0 1 0 .3 36.1 36.1 0 0 1-5.5 2.6.2.2 0 0 0-.1.3 47.1 47.1 0 0 0 3.6 5.9.2.2 0 0 0 .2.1 58.7 58.7 0 0 0 17.7-9 .2.2 0 0 0 .1-.1c1.5-15.4-2.5-28.2-10.4-40.7a.2.2 0 0 0-.1-.1zM23.7 36c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.6 0 6.5 3.3 6.4 7.2 0 4-2.8 7.2-6.4 7.2zm23.7 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.6 0 6.5 3.3 6.4 7.2 0 4-2.8 7.2-6.4 7.2z" fill="white" />
                </svg>
                Discord로 로그인
              </a>
            </div>

            <p className={styles.notice}>로그인 후 접근 가능한 문서만 표시됩니다.</p>
          </section>
        </section>

        <section className={styles.visualPanel}>
          <div className={styles.visualFrame}>
            <div className={styles.visualHeader}>Workspace Preview</div>
            <div className={styles.visualCards}>
              <article className={styles.visualCard}>
                <h4>문서 호환</h4>
                <p>한글/오피스 포맷을 하나의 편집 흐름으로 처리합니다.</p>
              </article>
              <article className={styles.visualCard}>
                <h4>자동 저장</h4>
                <p>편집 중 변경사항이 자동으로 저장되어 복구가 쉽습니다.</p>
              </article>
              <article className={styles.visualCard}>
                <h4>접근 제어</h4>
                <p>OAuth 인증과 사용자별 분리 저장소로 안전하게 보호됩니다.</p>
              </article>
            </div>
            <div className={styles.visualGrid}>
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
