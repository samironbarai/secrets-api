# Deployment

Live URL: https://secrets-api-mwng.onrender.com

Hosted on Render's free web service, deployed from the `main` branch of
https://github.com/samironbarai/secrets-api.

## How it was set up

1. Pushed the project to GitHub (`main` branch).
2. On Render: New > Web Service > Git Provider.
3. Granted Render's GitHub app access to `samironbarai/secrets-api`
   (Credentials > samironbarai > Configure).
4. Settings used:

| Setting | Value |
|---|---|
| Name | `secrets-api` |
| Language | Node |
| Branch | `main` |
| Region | Singapore (Southeast Asia) |
| Root directory | empty |
| Build command | `npm install` |
| Start command | `node server.js` |
| Instance type | Free ($0 / month) |
| Environment variables | none (Render sets `PORT`) |

5. Clicked Deploy web service and waited for the status to show Live.

## Releasing a change

```bash
git add .
git commit -m "Describe the change"
git push
```

Render redeploys automatically on every push to `main`.

Verify after each deploy:

```bash
BASE_URL=https://secrets-api-mwng.onrender.com npm test
```

The last line should be `All checks passed`.

## Free-tier limits

- The service sleeps after 15 minutes without traffic; the next request takes
  about a minute to wake it.
- The filesystem is wiped on every sleep, restart and redeploy, so
  `data/db.json` is lost: registered users, API keys and new secrets disappear
  and the 30 starter secrets come back.
- 750 free instance hours per month per workspace.

To keep data permanently, move storage from the JSON file to a hosted database
and put its connection string in Render's environment variables, never in the
repository.
