package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	apphttp "github.com/xed/test-restaurant-onboarding/backend/internal/http"

	"github.com/xed/test-restaurant-onboarding/backend/internal/config"
	"github.com/xed/test-restaurant-onboarding/backend/internal/llm"
	"github.com/xed/test-restaurant-onboarding/backend/internal/parse"
)

func main() {
	cfg := config.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: cfg.LogLevel,
	}))

	provider, err := llm.NewProvider(context.Background(), cfg, logger)
	if err != nil {
		logger.Warn("llm provider is not ready", "error", err)
	}

	server := apphttp.NewServer(cfg, logger, parse.NewService(provider))

	errCh := make(chan error, 1)
	go func() {
		logger.Info("http server starting", "addr", cfg.Addr)
		if err := server.Start(cfg.Addr); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-stop:
		logger.Info("shutdown signal received", "signal", sig.String())
	case err := <-errCh:
		logger.Error("http server failed", "error", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.Error("http server shutdown failed", "error", err)
		os.Exit(1)
	}

	logger.Info("http server stopped")
	time.Sleep(50 * time.Millisecond)
}
