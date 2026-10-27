# Sakshi Computer

## Local development

Create a local `.env`, generate a salted owner-password hash, add that hash to `.env`, and run the Express API with the Vite development server:

```powershell
npm ci
Copy-Item .env.example .env
npm run owner:hash
notepad .env
npm run dev
```

The local application uses `server/data/sakshi.sqlite` unless `DATABASE_PATH` is set.

## Deploying Express + React with Turso

The Express process serves both the built React app and `/api` in production. In Render, leave **Root Directory** blank because this repository root contains `package.json`; set the build command to `npm ci && npm run build`, and the start command to `npm start`. Do not deploy the Vite development server or use `vite preview` as the production server.

Set these server environment variables in Render:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `TURSO_DATABASE_ENGINE` | `libsql` for a libSQL database, or `tursodb` for a Turso Database engine database |
| `TURSO_DATABASE_URL` | The database URL shown by Turso |
| `TURSO_AUTH_TOKEN` | A database auth token with read/write access |
| `SESSION_COOKIE_SECURE` | `true` |
| `APP_ORIGINS` | `https://sakshicomputer-banking-manager.onrender.com`; comma-separate any additional exact trusted origins |
| `OWNER_USERNAME` | `SakshiComputer` |
| `OWNER_PASSWORD_HASH` | Salted scrypt hash generated locally with `npm run owner:hash`; never a plaintext password |

Render supplies `PORT`; the server binds to `0.0.0.0` in production. Do not set `DATABASE_PATH` in Render. Production startup requires the Turso URL and token and exits with an explicit error if either is missing; it never falls back to an ephemeral SQLite file.

The server also fails startup if either owner variable is missing or the hash is not in the generated scrypt format. The fixed environment owner is the only account accepted by the login handler; there is no public signup. Existing `owners` rows are not deleted or rewritten. Startup reuses a matching row, or inserts one only if needed so new sessions continue to reference `owners.id` through the existing foreign key. Other existing rows and customer records are left unchanged.

The engine setting selects the matching official SDK: `@libsql/client` for `libsql`, or `@tursodatabase/serverless` (compat API) for `tursodb`. Create the database in Turso with the engine you intend to use, then set the matching value. The URL, token, and engine are read only by the Node server; do not rename them to `VITE_*`, add them to Vite configuration, or put them in browser code.

## Owner password hash setup

From the repository root, run:

```powershell
npm run owner:hash
```

It asks you to type `GENERATE`, then prompts twice for the password without echoing it. It prints a salted `OWNER_PASSWORD_HASH=...` line, never the password. Treat the hash as a secret: do not commit it, put it in a command argument, or share it.

For local development, set `OWNER_PASSWORD_HASH` in `.env` to the generated line's value using Notepad, then run `npm run dev`. `.env.example` already contains `OWNER_USERNAME=SakshiComputer`.

For Render, open **Dashboard → your Web Service → Environment → Add Environment Variable** and add:

```text
OWNER_USERNAME = SakshiComputer
OWNER_PASSWORD_HASH = <paste the complete output from npm run owner:hash>
APP_ORIGINS = https://sakshicomputer-banking-manager.onrender.com
```

Keep the generated hash in Render’s server environment, not in GitHub, React, or any `VITE_*` variable. Saving the environment changes restarts the service. No database owner reset, deletion, or customer-data migration is needed for this authentication change.

## One-time local SQLite migration

Migration is never run by the app or deployment automatically. First make sure the local `.env` points `DATABASE_PATH` at the SQLite file to copy and has the target `TURSO_DATABASE_ENGINE`, `TURSO_DATABASE_URL`, and `TURSO_AUTH_TOKEN`. Confirm the URL belongs to the intended, empty Turso database. Then explicitly run:

```powershell
npm run db:migrate -- --confirm
```

Without `--confirm`, nothing is copied. The command reads the source SQLite database without modifying its records, copies owners, sessions, and applications in one remote transaction, and refuses to write if the target already contains any of those rows. Keep the local SQLite file and a backup until you have verified the migrated records in the deployed app. Migration copies password hashes and session hashes as well as application data, so protect the source, target, and backups accordingly.

## Backups

`npm run backup` and `npm run restore -- <backup-file>` remain for local SQLite only. They explicitly refuse to run when Turso is configured. For remote backups, install and authenticate the Turso CLI, then use its database dump:

```powershell
cmd /c "turso db shell <database-name> .dump > sakshi-backup.sql"
```

To restore that dump into a separate empty database, use:

```powershell
cmd /c "turso db shell <new-database-name> < sakshi-backup.sql"
```

Verify the restored data before changing the app's `TURSO_DATABASE_URL`. Dumps include application data and password hashes; store them encrypted with restricted access, keep them out of source control, and delete retired copies securely.

## Validation

```powershell
npm run test:server
npm run build
```

## CI/CD

GitHub Actions runs `.github/workflows/ci.yml` for pull requests and pushes to `main`. It installs from the repository lockfile with `npm ci`, then runs `npm run lint`, `npm run test:server`, and `npm run build`. The server test script runs every `server/*.test.js` test, including `app.test.js`, `backup.test.js`, `database.test.js`, and `hidden-input.test.js`; tests use fictional credentials and isolated temporary SQLite files. CI receives no Turso or owner credentials, does not upload artifacts, and does not run migration or owner-setup commands.

To configure Render to deploy only the checked `main` branch, connect this GitHub repository as a Web Service and set its **Branch** to `main`, leave **Root Directory** blank, set **Build Command** to `npm ci && npm run build`, and set **Start Command** to `npm start`. Under **Settings → Build & Deploy → Auto-Deploy**, select **After CI Checks Pass** (not **On Commit**). Do not add a second deploy workflow or deployment trigger. Set production credentials only in Render's Environment page.
