FROM golang:1.26-bookworm AS deps

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

FROM deps AS dev

CMD ["go", "run", "./cmd/server"]

FROM deps AS builder

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM debian:bookworm-slim AS runner

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /out/server ./server

EXPOSE 8080
CMD ["./server"]
