# RepoHawk Backend — Deployment Guide

Deploy the FastAPI backend to DigitalOcean (App Platform or VPS).

## Prerequisites

- DigitalOcean account with billing enabled
- OpenRouter API key (free tier: https://openrouter.ai/keys)
- The frontend is deployed (Vercel or other) — you need its URL for `FRONTEND_URL`

## Option A: DigitalOcean App Platform (recommended)

App Platform is DO's managed PaaS — handles SSL, zero-downtime deploys, and logging.

### 1. Push to GitHub

The repo must be on GitHub. App Platform pulls from there.

### 2. Create App

1. Go to https://cloud.digitalocean.com/apps → **Create App**
2. Select your GitHub repo and branch (`main`)
3. Set **Source Directory** to `backend/`
4. Choose **Dockerfile** as the build method (auto-detected)

### 3. Configure Environment Variables

In the App Platform dashboard, under **Environment Variables**, set:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host:port/db?sslmode=require` |
| `OPENROUTER_API_KEY` | Your OpenRouter key |
| `JWT_SECRET_KEY` | A strong random secret (see .env.example) |
| `FRONTEND_URL` | Your Vercel frontend URL (e.g., `https://repohawk.vercel.app`) |
| `RESEND_API_KEY` | Your Resend API key (optional, for email) |
| `RESEND_WELCOME_TEMPLATE_ID` | (optional) |
| `RESEND_PASSWORD_RESET_TEMPLATE_ID` | (optional) |
| `PORT` | `8000` (default, DO sets PORT automatically) |

### 4. Add Persistent Volumes

App Platform services are ephemeral — ChromaDB data must live on attached volumes:

1. In your app's **Settings** → **Volumes**
2. Add two volumes:
   - Mount path: `/app/chroma_db` — size: 1 GB minimum
   - Mount path: `/app/chroma_data` — size: 1 GB minimum

### 5. Database

**Option 5a: DO Managed Database**

1. Create a PostgreSQL cluster in DigitalOcean
2. Set trusted sources to include your App Platform app
3. Use the connection string (with `sslmode=require`) as `DATABASE_URL`

**Option 5b: PostgreSQL on a Droplet**

1. Spin up a Droplet, install PostgreSQL
2. Create the database and user:
   ```sql
   CREATE USER repohawk_user WITH PASSWORD 'strong_password';
   CREATE DATABASE repohawk_db OWNER repohawk_user;
   ```
3. Add the Droplet's IP to the `pg_hba.conf` and set `DATABASE_URL`

### 6. Run Migrations

On first deploy, the app needs its schema. App Platform runs your Dockerfile CMD — add a migration step:

**Approach: Build-time migration logic.** The Dockerfile's CMD can be changed to run Alembic then uvicorn:

```dockerfile
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
```

If you prefer separate migration control, SSH into the app or use a one-off DO function.

### 7. Deploy

Click **Launch App**. First build takes 5-10 minutes (model download + torch install). Subsequent deploys are faster due to Docker layer caching.

## Option B: DigitalOcean Droplet (VPS)

Manual setup for maximum control.

### 1. Create Droplet

- Ubuntu 24.04 LTS
- At least 4 GB RAM / 2 vCPUs (torch + sentence-transformers)
- Enable monitoring

### 2. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out and back in
```

### 3. Clone and Build

```bash
git clone https://github.com/YOUR_USER/RepoHawk.git
cd RepoHawk/backend

# Copy and edit .env
cp .env.example .env
# Edit .env with real values

docker build -t repohawk-api .
```

### 4. Create Docker Volumes

```bash
docker volume create repohawk_chroma_db
docker volume create repohawk_chroma_data
```

### 5. Run

```bash
docker run -d \
  --name repohawk-api \
  --restart unless-stopped \
  -p 8000:8000 \
  --env-file .env \
  -v repohawk_chroma_db:/app/chroma_db \
  -v repohawk_chroma_data:/app/chroma_data \
  repohawk-api
```

### 6. Reverse Proxy (SSL)

Use Caddy (simplest) or nginx:

```bash
# Caddy — auto SSL via Let's Encrypt
sudo apt install caddy
# Edit /etc/caddy/Caddyfile:
# your-domain.com {
#     reverse_proxy localhost:8000
# }
sudo systemctl reload caddy
```

### 7. Migrations

Run Alembic inside the container:

```bash
docker exec repohawk-api alembic upgrade head
```

## Option C: Docker Compose (local dev / single-VPS)

The root `docker-compose.yml` already defines a PostgreSQL service. For local dev, start it first:

```bash
docker compose up -d postgres
cd backend
cp .env.example .env  # edit DATABASE_URL to point to localhost:5432
uvicorn app.main:app --reload
```

For a single-VPS deployment with Docker Compose (API + DB together):

```bash
# Use root docker-compose.yml and add the API service
docker compose up -d
```

## Cold Start Notes

- **First deploy: 5-10 minutes.** The Dockerfile pre-downloads `all-MiniLM-L6-v2` (~80MB) during build, so no model download happens at runtime.
- **Torch install: ~200MB.** The `build-essential` apt package is required for wheel builds.

## Monitoring

- **Health check:** `GET /` returns `{"status": "healthy", "service": "RepoHawk API"}`
- **App Platform:** Built-in metrics and log forwarding
- **Droplet:** Install [Netdata](https://www.netdata.cloud/) or use DO's built-in graphs
- **Watch:** ChromaDB volumes — if they fill up (many repos analyzed), increase volume size