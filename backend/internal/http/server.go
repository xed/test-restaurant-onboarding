package http

import (
	"log/slog"
	stdhttp "net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/xed/test-restaurant-onboarding/backend/internal/config"
	"github.com/xed/test-restaurant-onboarding/backend/internal/http/handlers"
	"github.com/xed/test-restaurant-onboarding/backend/internal/parse"
)

func NewServer(cfg config.Config, logger *slog.Logger, parseService parse.Service) *echo.Echo {
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true
	e.Debug = false
	e.Server.ReadTimeout = cfg.ReadTimeout
	e.Server.WriteTimeout = cfg.WriteTimeout

	e.HTTPErrorHandler = errorHandler(logger)
	e.Use(middleware.RequestID())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"http://localhost:3000", "http://127.0.0.1:3000", "*"},
		AllowMethods: []string{
			stdhttp.MethodGet,
			stdhttp.MethodPost,
			stdhttp.MethodOptions,
		},
		AllowHeaders: []string{
			echo.HeaderAccept,
			echo.HeaderContentType,
			echo.HeaderOrigin,
			echo.HeaderXRequestedWith,
		},
	}))
	e.Use(requestLogger(logger))

	healthHandler := handlers.NewHealthHandler()
	healthHandler.Register(e)

	parseHandler := handlers.NewParseHandler(parseService, logger)
	parseHandler.Register(e)

	return e
}

func errorHandler(logger *slog.Logger) echo.HTTPErrorHandler {
	return func(err error, c echo.Context) {
		if c.Response().Committed {
			return
		}

		code := stdhttp.StatusInternalServerError
		message := stdhttp.StatusText(code)

		if httpErr, ok := err.(*echo.HTTPError); ok {
			code = httpErr.Code
			if msg, ok := httpErr.Message.(string); ok {
				message = msg
			} else {
				message = stdhttp.StatusText(code)
			}
		}

		if code >= stdhttp.StatusInternalServerError {
			logger.Error("request failed", "error", err, "status", code, "path", c.Path())
		}

		if jsonErr := c.JSON(code, map[string]string{"error": message}); jsonErr != nil {
			logger.Error("error response failed", "error", jsonErr)
		}
	}
}

func requestLogger(logger *slog.Logger) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			startedAt := time.Now()
			err := next(c)
			if err != nil {
				c.Error(err)
			}

			res := c.Response()
			req := c.Request()
			logger.Info(
				"http request",
				"method", req.Method,
				"path", req.URL.Path,
				"status", res.Status,
				"duration_ms", time.Since(startedAt).Milliseconds(),
				"request_id", res.Header().Get(echo.HeaderXRequestID),
			)
			return nil
		}
	}
}
