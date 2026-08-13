# GrooveShare Production Configuration

Version 2 Milestone 3 moves deployment-sensitive behavior behind environment-backed configuration so the same source can run locally and on a VPS without editing application code.

## Deployment shape

Local development keeps two origins:

```txt
Client: http://localhost:5173
API:    http://localhost:3000
```

Production should use one stable HTTPS hostname:

```txt
https://<grooveshare-hostname>/
https://<grooveshare-hostname>/api/...
```

The production reverse proxy will serve the built client and forward `/api` requests to the Node server. Leave `VITE_API_BASE_URL` unset for this same-origin production shape.

## Server configuration matrix

| Setting | Development | Production |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` |
| `PORT` | defaults to `3000` | required |
| `CLIENT_ORIGIN` | defaults to `http://localhost:5173` | required public HTTPS origin |
| `UPLOAD_ROOT` | defaults to the server upload directory | required absolute persistent path |
| `PGHOST` | defaults to `localhost` | required |
| `PGPORT` | defaults to `5432` | required |
| `PGDATABASE` | defaults to `grooveshare_dev` | required |
| `PGUSER` | defaults to `grooveshare_app` | required |
| `PGPASSWORD` | required | required secret |
| `PGTESTDATABASE` | local test database | not required by the production server |

`server/.env.example` documents the keys but contains no real password. The real `server/.env` remains ignored by Git. A production VPS may instead inject these values through its service/process environment.

## Client configuration

`VITE_API_BASE_URL` is optional.

- Development defaults to `http://localhost:3000`, so a client env file is normally unnecessary. If you override it locally, prefer a development-only Vite env file such as `client/.env.development.local`.
- Production defaults to an empty API base, so calls such as `/api/projects` remain on the public browser origin.
- Set `VITE_API_BASE_URL` only when intentionally hosting the browser and API on different origins.

The development toolbar is mounted only in Vite development mode.

## Production safety behavior

When `NODE_ENV=production`:

- session cookies use the `Secure` attribute;
- `/api/dev/*` seed/reset routes are not registered by the application router;
- command-line development seed/reset operations refuse to run;
- `UPLOAD_ROOT` must be an absolute path;
- server/database values required for deployment must be present and valid;
- newly uploaded audio metadata stores absolute filesystem paths so runtime audio storage does not depend on the process working directory.

## Verification commands

Run before the Milestone 3 commit and again before deployment:

```bash
npm run config:check
npm run db:check
npm run test-all
npm run build
npm run verify
```

`npm run verify` performs the configuration check, database connectivity check, all workspace typechecks/tests, and the production build.

## VPS handoff

After Milestone 3 is verified, Milestone 4 still needs to:

1. choose/configure the stable public hostname;
2. provision Linux and PostgreSQL;
3. create the production database/user and apply migrations;
4. choose a persistent absolute upload path;
5. configure the production environment values above;
6. install dependencies and run `npm run build`;
7. run the Node server with `npm run start-server` under a process/service manager;
8. serve `client/dist` and reverse proxy `/api` to Node;
9. enable HTTPS and firewall rules;
10. configure logs and backups;
11. perform the Owner/Contributor/Viewer production smoke test.
