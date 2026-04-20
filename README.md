# WebOffice

WebOffice는 Oracle Cloud Infrastructure(OCI)를 활용한 개인용 클라우드 HWP/HWPX 문서 에디터입니다.

## 주요 기능

- **HWP/HWPX 파싱:** `hwplib`를 연동하여 바이너리 및 XML 기반 한글 문서를 브라우저에서 즉시 확인.
- **실시간 편집:** WYSIWYG 에디터를 통해 글꼴, 크기, 스타일, 정렬 및 표/이미지 삽입 지원.
- **보안 스토리지:** OCI Object Storage API를 직접 연동하여 개인별 격리된 클라우드 공간 제공.
- **통합 인증:** Discord 및 Google OAuth2를 지원하며, Discord 서버 기반의 강화된 접근 권한 제어.

## 기술 스택

- **Frontend:** Next.js, React, CSS Modules
- **Backend:** Spring Boot, Java 17, Gradle (KTS)
- **Library:** kr.dogfoot:hwplib (한글 문서 파싱)
- **Cloud:** Oracle Cloud Infrastructure (OCI Object Storage)

## 시작하기

### 백엔드 설정

1. `backend/src/main/resources/application.yml`의 환경변수 설정.
2. `./gradlew bootRun`으로 서버 실행 (기본 8080 포트).

### 프론트엔드 설정

1. `frontend` 폴더에서 `npm install` 실행.
2. `npm run dev`로 개발 서버 실행 (기본 3000 포트).

## 라이선스

이 프로젝트는 개인 학습 및 개인용 클라우드 구축을 위해 개발되었습니다.
