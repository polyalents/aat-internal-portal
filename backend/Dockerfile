FROM python:3.12-slim

# Системные зависимости
RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  gcc \
  libpq-dev \
  libmagic1 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем весь проект
COPY . .

# Обновляем pip и ставим зависимости
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
  pip install --no-cache-dir .

# Папка для загрузок
RUN mkdir -p /app/uploads

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]