# Bezalel API — backend de referência (somente leitura).
# Build: docker build -t bezalel-api .
# Run:   docker run -d --name bezalel-api -p 127.0.0.1:8100:8100 --env-file .env bezalel-api
# Segredos (LLM_API_KEY etc.) nunca entram na imagem: sempre via --env-file.
FROM python:3.13-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY data ./data

RUN useradd --create-home --shell /usr/sbin/nologin appuser
USER appuser

EXPOSE 8100
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8100/health', timeout=2)" || exit 1

# 1 worker: o rate limit do assistente vive em memória (ver app/main.py).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100", "--workers", "1", "--proxy-headers"]
