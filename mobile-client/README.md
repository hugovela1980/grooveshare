# GrooveShare Mobile Client

`mobile-client/` is the dedicated phone-oriented Vite presentation introduced in Version 2 Milestone 6.

It intentionally shares application behavior through `@hugovela/frontend-core` while owning its own DOM templates, navigation, editing interaction, and CSS.

Current shared boundaries include:

- domain types and permission rules;
- `SessionProvider`;
- `StorageProvider`;
- mix persistence/recovery;
- `PlaybackEngine` and the current HTML-audio implementation.

The browser API wrapper files are temporarily duplicated from `client/` during the Phase 1 architecture proof. They target the same GrooveShare server and can be reconsidered after real multi-client use demonstrates a stable extraction boundary.

## Local development

From the repository root:

```bash
npm run dev-server
npm run dev-client
npm run dev-mobile
```

The web client runs on `http://localhost:5173` and the mobile client runs on `http://localhost:5174`.

The mobile Vite server proxies `/api` to the local Node server on `http://127.0.0.1:3000`, allowing both clients to run at the same time without changing the server's development CORS origin.

## Verification

```bash
npm run test-mobile
npm run build -w mobile-client
```
