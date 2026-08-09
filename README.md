# Calendar Frontend

React + Vite + TypeScript frontend for the calendar backend V3 HTTP API.

## Prerequisites

- Node.js 20+
- Running API server from [calendar_backend](https://github.com/nerryschwartz/calendar_backend):

```bash
cd calendar_backend
uv run calendar-backend-api
```

Default API base URL: `http://127.0.0.1:8000`

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`.

## Routes

| Path | View |
|---|---|
| `/calendars` | Task + free-time calendar |
| `/calendars/blocks` | Block calendar |
| `/plan-tree` | Master plan root |
| `/plan-tree/:planId` | Plan node detail |
| `/timers` | Active timers |
| `/notifications` | Notification queue |

## Scripts

- `npm run dev` — start dev server
- `npm run build` — typecheck and production build
- `npm run preview` — preview production build

See [docs/v1_setup.md](docs/v1_setup.md) for architecture notes.
