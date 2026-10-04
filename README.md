# Secrets API

A practice REST API for learning API authentication, modelled on the App Brewery Secrets API. Built with Node.js and Express.

| Auth level | Endpoints |
|---|---|
| None | `GET /random` |
| Basic auth | `GET /all?page=1` |
| API key | `GET /filter?score=5&apiKey=...` |
| Bearer token | `GET /user-secrets`, `GET/PUT/PATCH/DELETE /secrets/:id`, `POST /secrets` |
| Setup | `POST /register`, `GET /generate-api-key`, `POST /get-auth-token` |

Full documentation is served at `/` when the server is running.

## Files

- `server.js`: the routes and auth middleware
- `seed.js`: 30 starter secrets
- `docs.html`: the documentation page served at `/`
- `test.js`: end-to-end check of every endpoint
- `data/db.json`: created on first write; holds users, API keys and secrets

## Setup, step by step

### 1. Install

Requires Node.js 18 or newer.

```bash
node --version      # verify: v18 or higher
npm install
```

Verify: a `node_modules` folder exists and `npm ls express` shows express 4.x.

### 2. Start the server

```bash
npm start
```

Verify: the terminal prints `Secrets API running at http://localhost:3000`, and opening that address shows the documentation page.

### 3. Check level 0 (no auth)

```bash
curl http://localhost:3000/random
```

Verify: you get one JSON secret with `id`, `secret`, `emScore`, `username`, `timestamp`.

### 4. Check level 1 (basic auth)

```bash
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"username":"jackbauer","password":"IAmTheBest"}'

curl -u jackbauer:IAmTheBest "http://localhost:3000/all?page=1"
```

Verify: the first call returns `Successfully registered.`; the second returns 10 secrets. Without `-u` it returns 401.

### 5. Check level 2 (API key)

```bash
curl http://localhost:3000/generate-api-key
curl "http://localhost:3000/filter?score=5&apiKey=PASTE_KEY_HERE"
```

Verify: every secret returned has `emScore` of 5 or more.

### 6. Check level 3 (bearer token)

```bash
curl -X POST http://localhost:3000/get-auth-token \
  -H "Content-Type: application/json" \
  -d '{"username":"jackbauer","password":"IAmTheBest"}'

curl -X POST http://localhost:3000/secrets \
  -H "Authorization: Bearer PASTE_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"secret":"My first secret","score":3}'

curl http://localhost:3000/user-secrets -H "Authorization: Bearer PASTE_TOKEN_HERE"
```

Verify: the new secret comes back with your username, and `/user-secrets` lists it.

### 7. Run the full test

With the server still running, in a second terminal:

```bash
npm test
```

Verify: the last line is `All checks passed`.

### 8. Commit to Git

```bash
git init
git add .
git commit -m "Secrets API: Express clone with four auth levels"
```

`.gitignore` already excludes `node_modules/` and `data/`.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port to listen on |
| `DB_FILE` | `data/db.json` | Where data is stored |

To reset to the starter secrets, stop the server and delete `data/db.json`.

## Design choices

- **Storage** is a single JSON file, rewritten on every change. That suits a teaching API; swap in SQLite or Postgres if it will see real traffic.
- **Passwords** are hashed with scrypt from Node's built-in `crypto`. Tokens and API keys are random UUIDs and do not expire.
- **Ownership**: any token can read any secret, but only the author can PUT, PATCH or DELETE it (403 otherwise). To let anyone edit anything, change `loadSecret(true)` to `loadSecret(false)` in `server.js`.
- **Scores** must be whole numbers from 0 to 10.

## Before putting it on the public internet

- Add rate limiting (for example `express-rate-limit`), especially on `/register` and `/generate-api-key`, which anyone can call without limit.
- Serve it over HTTPS; basic auth and bearer tokens are sent in plain headers.
- Use a host with a persistent disk, or move storage to a database. Hosts with ephemeral filesystems will lose `data/db.json` on each deploy.
