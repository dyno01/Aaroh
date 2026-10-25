# Deploy Aaroh on Render

## GitHub (drag the folder)

Dragging `aaroh` into a new GitHub repo is fine. **Do not upload `node_modules` or `client/dist`.**

Check the repo: you should see `package.json`, `client/`, `server/` at the **top**.

If GitHub looks like this instead:

```
aaroh/
  package.json
  client/
  server/
```

then in Render set **Root Directory** = `aaroh`.

## Render

1. Go to [render.com](https://render.com) → **New** → **Web Service** → connect that GitHub repo.
2. Settings:
3. Settings:

| Field | Value |
| --- | --- |
| Runtime | Node |
| Build command | `sh render-build.sh` |
| Start command | `npm start` |
| Node version | `20` |
| Instance | Free (or Starter if Free is gone) |

Do **not** leave the default `yarn install; yarn build`. Set the build command yourself.

4. Environment:

- `NODE_VERSION` = `20`
- `NPM_CONFIG_PRODUCTION` = `false`
- `JWT_SECRET` = any long random string

Do **not** set `NODE_ENV=production` as a build env var (Render already does that at start). It hides Vite and the build dies.

5. Deploy. Open the `onrender.com` URL.

## Logins

| Role | Email | Password |
| --- | --- | --- |
| Coach | `admin@aaroh.in` | `Aaroh@123` |
| Student | `demo@aaroh.in` | `Aaroh@123` |

Import papers from Coach desk after login. Do **not** run `seed.js`.

## Backblaze B2 Automatic Backup & Sleep Protection

Aaroh now includes **automatic Backblaze B2 cloud database backup and restore**:
1. **Never lose scores or attempts**: Whenever students submit attempts, save answers, or gain streaks, changes are automatically and safely backed up to Backblaze B2 (`database/aaroh.db`).
2. **Settings never reset**: Custom exam settings, calculators, hints, and passwords are preserved in Backblaze B2 and are not clobbered on reboots.
3. **Zero-downtime wake-up**: When Render free services spin down after inactivity and wake up on a fresh container, Aaroh downloads the latest database from Backblaze B2 before starting the server. It feels like nothing ever stopped!
4. **Shutdown snapshot**: On Render sleep or redeployment (`SIGTERM`), pending changes are immediately snapshotted and uploaded to Backblaze B2.

Optional environment variables for your own bucket:
- `B2_KEY_ID`
- `B2_APPLICATION_KEY`
- `B2_BUCKET_ID`
- `B2_BUCKET_NAME` (default: `aaroh-papers`)

## Local dual ports

On your laptop it still serves 5173 + 4000. On Render it only uses `PORT`.
