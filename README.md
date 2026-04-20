# WebOffice

WebOffice is a personal cloud document workspace with multi-format editing support, OAuth2 login, and user-isolated object storage.

It is built with:
- Backend: Spring Boot 3 (Java 17), Apache POI, OCI Object Storage SDK
- Frontend: Next.js 16, React 19, TypeScript

## Features

- Dual OAuth2 login: Google and Discord
- JWT authentication flow for API access
- User-scoped file isolation in object storage
- Multi-format parsing and editing model
  - HWP / HWPX
  - DOCX / DOC
  - XLSX / XLS
  - PPTX
- Format-aware editor UI
  - Text document canvas
  - Spreadsheet grid editor
  - Presentation slide navigator
- Dynamic ribbon UI by file type
- Debounced auto-save for editor updates

## Repository Structure

```text
backend/   Spring Boot API (auth, storage, document parsing/save)
frontend/  Next.js app (dashboard, editor, ribbon UI)
```

## Prerequisites

- Java 17+
- Node.js 20+
- npm 10+
- OCI account and bucket (for storage features)
- OAuth app credentials (Google and/or Discord)

## Quick Start

### 1) Clone

```bash
git clone https://github.com/minseo0388/weboffice.git
cd weboffice
```

### 2) Backend setup

Configure backend settings in `backend/src/main/resources/application.yml`.

Typical values:
- OAuth client IDs/secrets
- JWT secret
- OCI namespace/bucket/credentials

Run backend:

```bash
cd backend
./gradlew bootRun
```

On Windows PowerShell:

```powershell
cd backend
.\gradlew.bat bootRun
```

Backend default URL: `http://localhost:8080`

### 3) Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Frontend default URL: `http://localhost:3000`

Note: if port `3000` is already in use, Next.js may automatically switch to `3001`.

## Local Development Notes

- The frontend has an API rewrite for `/api/*` to backend `http://localhost:8080/api/*`.
- OAuth buttons on the landing page use `NEXT_PUBLIC_BACKEND_URL` if provided.
  - If not set, default backend URL is `http://localhost:8080`.
- To verify backend health quickly:

```bash
curl http://localhost:8080/api/documents/fontmap
```

## Build

Backend:

```bash
cd backend
./gradlew clean build -x test
```

Frontend:

```bash
cd frontend
npm run build
```

## Current Status

- Core upload/list/download/delete flows are implemented.
- Multi-format parse/save pipeline is integrated.
- Editor surface supports format-specific rendering and ribbon controls.
- Some advanced collaborative/runtime features are still in progress.

## Maintainer

[@minseo0388](https://github.com/minseo0388)

## Contributing

Issues and PRs are welcome.

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a pull request

## License

MIT © minseo0388
