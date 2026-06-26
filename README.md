# Структура проекта

```text
.
├── backend/                  # Go backend service
│   ├── cmd/server/            # точка входа HTTP-сервера
│   ├── internal/api/          # API response/error models
│   ├── internal/config/       # чтение env-конфигурации
│   ├── internal/http/         # Echo server, routes, handlers
│   ├── internal/llm/          # абстракция LLM-провайдера и OpenAI Responses flow
│   ├── internal/parse/        # сервис парсинга документов
│   └── internal/prompts/      # prompt templates для legal/banking/menu
├── frontend/                 # Next.js onboarding UI
│   ├── app/                   # App Router routes: legal, banking, menu, restaurant
│   ├── components/            # UI и onboarding components
│   └── lib/                   # API client, React Query mutations, localStorage state
├── .deploy/
│   ├── docker-compose.local.yml
│   └── .env.example
├── .context/                 # локальная память проекта
├── TASK.md                   # исходное тестовое задание
└── backlog.md                # план реализации
```

# Переменные окружения

Шаблон локальных переменных лежит в `.deploy/.env.example`.

Для запуска через Docker Compose скопируй его в `.deploy/.env`:

```bash
cp .deploy/.env.example .deploy/.env
```

Минимально для реального парсинга через OpenAI нужно заполнить:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5
OPENAI_BASE_URL=https://api.openai.com/v1
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

Если нужен Anthropic, переключи провайдера и заполни Anthropic-переменные:

```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=...
ANTHROPIC_BASE_URL=
```

Также в `.deploy/.env.example` есть backend timeouts:

- `LLM_TIMEOUT` - общий timeout LLM-запроса, по умолчанию `180s`;
- `READ_TIMEOUT` - HTTP read timeout, по умолчанию `10s`;
- `WRITE_TIMEOUT` - HTTP write timeout, по умолчанию `240s`;
- `LOG_LEVEL` - уровень логирования, по умолчанию `info`.

Секреты не нужно коммитить. `.deploy/.env.example` хранит только пустые placeholders и безопасные defaults.

# Локальный запуск через Docker Compose

Основной способ локального запуска - `.deploy/docker-compose.local.yml`.

```bash
cp .deploy/.env.example .deploy/.env
# заполни OPENAI_API_KEY или переменные другого провайдера

docker compose --env-file .deploy/.env -f .deploy/docker-compose.local.yml up --build
```

После старта:

- frontend: http://localhost:3000
- backend healthcheck: http://localhost:8080/health
- backend API base URL для браузера: `http://localhost:8080`

Compose поднимает два сервиса:

- `backend` - собирается из `backend/Dockerfile`, target `dev`, запускает `go run ./cmd/server`, слушает порт `8080`;
- `frontend` - собирается из `frontend/Dockerfile`, target `dev`, запускает `npm run dev -- --hostname 0.0.0.0`, слушает порт `3000`.

Исходники `backend/` и `frontend/` bind-mounted внутрь контейнеров, поэтому изменения кода доступны без пересборки образа. Если меняются зависимости или Dockerfile, перезапусти compose с `--build`.

Остановить локальную инфраструктуру:

```bash
docker compose --env-file .deploy/.env -f .deploy/docker-compose.local.yml down
```

# Запуск без Docker

Backend:

```bash
cd backend
export PORT=8080
export LOG_LEVEL=info
export LLM_PROVIDER=openai
export LLM_TIMEOUT=180s
export WRITE_TIMEOUT=240s
export OPENAI_API_KEY=...
export OPENAI_MODEL=gpt-5
export OPENAI_BASE_URL=https://api.openai.com/v1
go run ./cmd/server
```

Frontend:

```bash
cd frontend
npm install
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080 npm run dev
```

Проверки:

```bash
cd backend
go test ./...

cd ../frontend
npm run typecheck
npm run lint
npm run build
```

# API

Backend предоставляет:

- `GET /health` - проверка работоспособности сервиса;
- `POST /parse/legal` - multipart upload legal document, поле `file`;
- `POST /parse/bank_account` - multipart upload RIB/bank document, поле `file`;
- `POST /parse/menu` - multipart upload menu files, поле `files[]`.

Поддерживаемые документы для парсинга: PDF и изображения. Ответы возвращаются в JSON, ошибки парсинга приводятся к контролируемому `could_not_parse`, а клиентские ошибки загрузки возвращаются отдельными error codes.

# Развертывание

В репозитории есть Dockerfile для backend и frontend с production-capable `runner` stages.

Backend production image:

```bash
docker build -t restaurant-onboarding-backend:latest --target runner ./backend
```

Frontend production image:

```bash
docker build \
  -t restaurant-onboarding-frontend:latest \
  --target runner \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://your-backend.example.com \
  ./frontend
```

Для production окружения нужно передать backend-переменные окружения на уровне платформы деплоя:

- `PORT`
- `LOG_LEVEL`
- `LLM_PROVIDER`
- `LLM_TIMEOUT`
- `READ_TIMEOUT`
- `WRITE_TIMEOUT`
- `OPENAI_API_KEY` / `OPENAI_MODEL` / `OPENAI_BASE_URL`
- или `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` / `ANTHROPIC_BASE_URL`

Frontend должен быть собран с корректным `NEXT_PUBLIC_API_BASE_URL`, потому что это публичная browser-side переменная Next.js.
