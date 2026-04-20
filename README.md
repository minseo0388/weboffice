# WebOffice

> A premium personal cloud HWP/HWPX document editor powered by Oracle Cloud Infrastructure.

WebOffice is an open-source web-based HWP/HWPX editor designed for individuals who need to manage their Korean documents in a secure, personal cloud environment. It features dual OAuth2 authentication (Google and Discord) and utilizes OCI Object Storage for reliable file persistence.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

## Install

### Prerequisites

- Java 17 or higher
- Node.js 20 or higher
- Oracle Cloud Infrastructure (OCI) Account
- Discord/Google Developer Console Access (for OAuth2)

### Clone

```bash
git clone https://github.com/minseo0388/weboffice.git
cd weboffice
```

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Configure `src/main/resources/application.yml` with your OCI and OAuth2 credentials. Or set environment variables:
   - `ORACLE_NS`, `GOOGLE_CLIENT_ID`, `DISCORD_CLIENT_ID`, `JWT_SECRET_KEY`, etc.
3. Build and run:
   ```bash
   ./gradlew bootRun
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

## Usage

1. Open your browser and navigate to `http://localhost:3000`.
2. Sign in using Google or Discord.
3. Upload HWP/HWPX files to your personal dashboard.
4. Click on a file to open the premium WYSIWYG editor.
5. Edit text, insert tables, upload images, and save changes back to your OCI bucket.

## Maintainers

[@minseo0388](https://github.com/minseo0388)

## Contributing

PRs accepted. Feel free to dive in! [Open an issue](https://github.com/minseo0388/weboffice/issues/new) or submit PRs.

Standard Readme follows the [Contributor Covenant](https://www.contributorcovenant.org/version/2/0/code_of_conduct/) Code of Conduct.

## License

MIT © minseo0388
