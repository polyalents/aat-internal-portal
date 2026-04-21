# AAT Internal Portal

Internal corporate portal for employees and IT support.

Full-stack application developed from scratch. Covers internal processes, support workflows and basic automation.

## What I did

- full-stack development (frontend + backend)
- backend development using FastAPI (API and business logic)
- authentication system (JWT, refresh tokens, rotation, reuse detection)
- database design and migrations (PostgreSQL, Alembic)
- background tasks and notifications (Celery + Redis)
- frontend development using React (Vite)
- nginx configuration and reverse proxy setup
- deployment on VPS (Docker, systemd)
- basic monitoring and health checks
- security configuration (CSP, headers, CORS, upload restrictions)

## Features

- authentication and sessions
- user profiles

- employees / org tree
  - employee cards
  - departments management

- IT support system
  - ticket creation and tracking
  - status management
  - notifications on updates

- internal chat system
  - direct messages (private chat)
  - delayed notifications for unread messages (>10 min)
  - department chats (planned)
  - cross-department group chats (planned)

- notifications
  - user registration notifications
  - ticket notifications
  - chat message notifications

- admin panel
  - user accounts creation
  - employee cards management
  - departments management

- announcements
- knowledge base

## Tech stack

Backend:
- FastAPI
- SQLAlchemy
- Alembic
- Celery
- Redis
- PostgreSQL

Frontend:
- React
- Vite

Infrastructure:
- Docker
- Docker Compose
- Nginx
- systemd

## Project structure

backend/    — backend  
frontend/   — frontend  
deploy/     — deploy notes  
nginx/      — nginx configs  

## Local run

Docker:

docker compose up -d --build

Manual:

Backend:
cd backend  
source .venv/bin/activate  
uvicorn app.main:app --host 0.0.0.0 --port 8000  

Frontend:
cd frontend  
npm install  
npm run dev  

## Health check

curl http://127.0.0.1:8000/api/health

## Production

Nginx:
sudo nginx -t  
sudo systemctl reload nginx  

Backend:
sudo systemctl restart aat-backend.service  
sudo systemctl status aat-backend.service --no-pager  

Celery:
sudo systemctl daemon-reload  
sudo systemctl restart aat-celery.service  
sudo systemctl restart aat-celery-beat.service  

## Logs

sudo journalctl -u aat-backend.service -n 100 --no-pager  
sudo journalctl -u aat-celery.service -n 100 --no-pager  
sudo journalctl -u aat-celery-beat.service -n 100 --no-pager  

## Security

- security headers  
- CSP  
- CORS hardening  
- upload restrictions  
- refresh token rotation  
- nginx hardening  

## HTTPS

Enabled for internal environment  
Custom CA used  
HSTS disabled  

## Notes

- system uses systemd services  
- Celery worker and beat configured  
- project intended for internal network  

## TODO

- Telegram bot for admin / IT notifications  
- public domain instead of .local  

## Status

Active development