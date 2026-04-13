# Deploy notes

## Production paths

### Nginx

Main config:

`/etc/nginx/sites-available/portal.aat.local`

Enabled symlink:

`/etc/nginx/sites-enabled/portal.aat.local`

### systemd

Service files:

- `/etc/systemd/system/aat-backend.service`
- `/etc/systemd/system/aat-celery.service`
- `/etc/systemd/system/aat-celery-beat.service`

## Nginx deploy

Check config:

```bash
sudo nginx -t
```

Apply:

```bash
sudo systemctl reload nginx
```

## Backend deploy

```bash
sudo systemctl restart aat-backend.service
```

Check:

```bash
sudo systemctl status aat-backend.service --no-pager
curl http://127.0.0.1:8000/api/health
```

## Celery deploy

```bash
sudo systemctl daemon-reload
sudo systemctl restart aat-celery.service
sudo systemctl restart aat-celery-beat.service
```

Check:

```bash
sudo systemctl status aat-celery.service --no-pager
sudo systemctl status aat-celery-beat.service --no-pager
```

Logs:

```bash
sudo journalctl -u aat-celery.service -n 100 --no-pager -l
sudo journalctl -u aat-celery-beat.service -n 100 --no-pager -l
```

## Health checks

HTTP:

```bash
curl http://portal.aat.local/api/health
```

HTTPS:

```bash
curl -k https://portal.aat.local/api/health
```

## HTTPS notes

HTTPS is currently enabled for internal environment.

Current certificate files:
- `/etc/nginx/ssl/portal.aat.local.crt`
- `/etc/nginx/ssl/portal.aat.local.key`

Internal CA root certificate:
- `/etc/nginx/ssl/ca/rootCA.crt`

HSTS must remain disabled for now.

## Celery notes

Current services use:
- worker hostname: `aat-worker@%H`
- beat schedule file: `/home/admin865/aat-internal-portal/backend/celerybeat-schedule`

## Remaining work

- SMTP / email notifications
- Telegram notifications
- normal domain instead of `.local`
