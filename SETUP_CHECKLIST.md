# Setup checklist

Everything below is **for you to do** (we can’t create OAuth apps or set env vars in Vercel for you).

---

## Part A — Minimum setup (username/password sign-in)

1. **Create `.env`** in the project root (same folder as `package.json`). Copy from `.env.example`:
   ```bash
   cp .env.example .env
   ```
2. **Edit `.env`** and set:
   - `DATABASE_URL` — From [Neon](https://neon.tech) or [Vercel Postgres](https://vercel.com/storage/postgres): create a project, copy the connection string.
   - `NEXTAUTH_SECRET` — Run in terminal: `openssl rand -base64 32`, paste the output.
   - `NEXTAUTH_URL` — Set to `http://localhost:3000`.
3. **Install and migrate:**
   ```bash
   npm install
   npm run prisma:migrate
   npm run dev
   ```
4. Open **http://localhost:3000/auth/signin**, switch to **Sign up**, create a username/password account, and sign in.

---

## Part B — Optional: GitHub OAuth

1. Go to **https://github.com/settings/developers** and sign in.
2. Click **“OAuth Apps”** → **“New OAuth App”**.
3. Fill in:
   - **Application name:** e.g. `Quant Risk Snapshot`
   - **Homepage URL:**  
     - Local: `http://localhost:3000`  
     - Production: `https://quant-risk-snapshot.vercel.app` (or your Vercel URL)
   - **Authorization callback URL:**  
     - Local: `http://localhost:3000/api/auth/callback/github`  
     - Production: `https://quant-risk-snapshot.vercel.app/api/auth/callback/github`  
     (You can create one app and add **both** callback URLs in GitHub, or use two apps for local vs production.)
4. Click **“Register application”**.
5. On the app page, click **“Generate a new client secret”** and copy it once (you won’t see it again).
6. Copy the **Client ID** and the **Client secret** — you’ll use them as `GITHUB_ID` and `GITHUB_SECRET`.

## Part C — Vercel (production)

1. Go to **https://vercel.com** → your **Quant Risk Snapshot** project → **Settings** → **Environment Variables**.
2. Add these variables (for **Production**, and **Preview** if you want):
   - `DATABASE_URL` — Same Postgres URL you use locally (or a separate DB for prod).
   - `NEXTAUTH_SECRET` — Same as local or generate another with `openssl rand -base64 32`.
   - `NEXTAUTH_URL` — Your live URL, e.g. `https://quant-risk-snapshot.vercel.app` (no trailing slash).
   - `GITHUB_ID` and `GITHUB_SECRET` — Optional, only needed if you want GitHub login.
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` — Optional, only needed if you want Google login.
3. **Redeploy:** **Deployments** → open the latest deployment → **⋮** → **Redeploy** (without using cache).
4. After the build finishes, open `https://quant-risk-snapshot.vercel.app/auth/signin`:
   - Sign up with username/password (always available), and/or
   - use GitHub/Google buttons if you configured those env vars.

---

## Quick reference

| Step              | Where / What |
|-------------------|--------------|
| GitHub OAuth app (optional)  | https://github.com/settings/developers |
| GitHub callback (local)      | `http://localhost:3000/api/auth/callback/github` |
| GitHub callback (Vercel)     | `https://YOUR_APP.vercel.app/api/auth/callback/github` |
| Generate secret   | `openssl rand -base64 32` |
| Env file template | `.env.example` → copy to `.env` |

If something fails, check: (1) `DATABASE_URL` + `NEXTAUTH_SECRET` + `NEXTAUTH_URL` are set, (2) OAuth callback URLs match your app URL if using GitHub/Google, (3) you redeployed after changing Vercel env vars.
