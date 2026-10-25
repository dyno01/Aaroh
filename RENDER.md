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

## SQLite on free Render

The database file lives on the instance disk. **Free web services lose that disk when the app sleeps or redeploys.** After a restart you may need to import papers again.

To keep data: add a **persistent disk** (paid) mounted at `/data`, then set:

`DB_PATH=/data/aaroh.db`

## Local dual ports

On your laptop it still serves 5173 + 4000. On Render it only uses `PORT`.
