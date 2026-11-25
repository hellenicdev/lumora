# Lumora

**AI software intelligence platform.** Connect a GitHub repository and Lumora understands your codebase: it generates documentation, maps the architecture, answers engineering questions in chat, and flags security and dependency risks.

**Live:** https://hellenicdev.eu/lumora/

## Features

- GitHub OAuth sign-in and repository import
- Automated analysis: architecture and dependency graphs, API endpoint discovery, environment variable inventory
- AI-generated documentation, wiki and README drafts, with version history
- Codebase chat grounded in your repository
- Security scanning, drift detection and repository health scores
- Shareable read-only reports
- Organizations, teams, roles, invitations and an audit log
- API keys and a public API, webhooks and integrations
- Usage-based plans with Ko-fi upgrades
- Email verification and password reset via Resend, Cloudflare Turnstile on auth forms
- Light and dark themes, consent-gated analytics

## Tech stack

| Layer | Tech |
| --- | --- |
| Frontend | Static HTML, CSS and vanilla JavaScript (GitHub Pages) |
| Backend | Node.js, Express, Socket.IO, Helmet, express-rate-limit |
| AI | Groq (OpenAI-compatible SDK) |
| Database | MongoDB via Mongoose |
| Email | Resend |
| Monitoring | Sentry |
| Hosting | GitHub Pages (frontend), Render (API) |

## Getting started

Requirements: Node.js 20+, a MongoDB connection string and a GitHub OAuth app.

```bash
git clone https://github.com/hellenicdev/lumora.git
cd lumora
cp .env.example backend/.env   # fill in the values
cd backend
npm install
npm run dev
```

Serve the repo root with any static server (for example `npx serve .`) and point `js/config.js` at your local API.

### Environment variables

Names only. Never commit real values.

| Group | Names |
| --- | --- |
| Server | `PORT`, `NODE_ENV`, `FRONTEND_URL`, `ALLOWED_ORIGINS`, `RENDER_EXTERNAL_URL`, `LOG_LEVEL` |
| Database | `MONGODB_URI` |
| Auth | `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`, `ENCRYPTION_KEY`, `TURNSTILE_SECRET` |
| GitHub | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL` |
| AI | `AI_PROVIDER`, `AI_API_KEY`, `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_MODEL_FAST` |
| Email | `RESEND_API_KEY`, `RESEND_FROM` |
| Files | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Billing | `KOFI_PAGE_URL`, `KOFI_WEBHOOK_TOKEN` |
| Monitoring | `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE` |

## Project structure

```
lumora/
├── *.html            Pages: landing, auth, dashboard, repositories, chat, docs, team, audit, reports…
├── css/              Shared and per-page styles
├── js/               Page scripts, API client, auth, theme, consent
├── backend/
│   ├── config/       Config and database indexes
│   ├── controllers/  Route handlers
│   ├── database/     MongoDB connection
│   ├── github/       GitHub API and OAuth clients
│   ├── jobs/         Background import queue
│   ├── middlewares/  Auth, API keys, CSRF origin check, rate limiting, roles, Turnstile, usage, validation
│   ├── models/       Mongoose schemas
│   ├── routes/       REST routes
│   ├── services/     Analysis, AI, docs, security, teams, usage…
│   ├── socket/       Real-time updates
│   └── server.js     Entry point
└── render.yaml
```

## License

© 2026 HellenicDev. All rights reserved.

Built by [HellenicDev](https://hellenicdev.eu).
