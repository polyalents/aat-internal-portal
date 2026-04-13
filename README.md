# AAT Internal Portal

Internal corporate portal for employees and IT support.

## Current stack

### Backend
- FastAPI
- SQLAlchemy
- Alembic
- Celery
- Redis
- PostgreSQL

### Frontend
- React
- Vite

### Infra
- Nginx
- systemd
- Docker / Docker Compose

## Main modules

- authentication
- user profile
- employees and org tree
- IT support tickets
- announcements
- knowledge base
- internal chat
- admin settings

## Project structure

- `backend/` — backend application
- `frontend/` — frontend application
- `deploy/` — deploy templates and deploy notes
- `nginx/` — project nginx configs

## Environment

Main backend env file:

`backend/.env`

Example variables are described in:

- `.env.example`
- `backend/.env.example` if present

## Local run

### Backend

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Docker Compose

```bash
docker compose up -d --build
```

## Production services

Server uses these services:

- `aat-backend.service`
- `aat-celery.service`
- `aat-celery-beat.service`
- `nginx`

## Useful checks

### Backend health

```bash
curl http://127.0.0.1:8000/api/health
```

### Through nginx

```bash
curl http://portal.aat.local/api/health
curl -k https://portal.aat.local/api/health
```

### Service status

```bash
sudo systemctl status aat-backend.service --no-pager
sudo systemctl status aat-celery.service --no-pager
sudo systemctl status aat-celery-beat.service --no-pager
sudo systemctl status nginx --no-pager
```

### Logs

```bash
sudo journalctl -u aat-backend.service -n 100 --no-pager
sudo journalctl -u aat-celery.service -n 100 --no-pager
sudo journalctl -u aat-celery-beat.service -n 100 --no-pager
```

## Security status

Already implemented:

- security headers
- CSP
- CORS hardening
- upload hardening
- refresh token rotation
- refresh token reuse detection
- nginx hardening
- HTTPS for internal environment
- celery worker and beat cleanup

## HTTPS notes

- HTTPS is enabled for internal environment
- HSTS is intentionally disabled for now

## Remaining work

- SMTP / email notifications
- Telegram notifications

## Deployment notes

See:

`deploy/DEPLOY.md`
