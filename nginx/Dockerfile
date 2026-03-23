# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build

WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Nginx with frontend build
FROM nginx:1.27-alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx/nginx.conf /etc/nginx/conf.d/portal.conf
COPY nginx/ssl/ /etc/nginx/ssl/
COPY --from=frontend-build /app/dist /usr/share/nginx/html

EXPOSE 80 443