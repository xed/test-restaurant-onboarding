package handlers

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
)

type HealthHandler struct {
	startedAt time.Time
}

func NewHealthHandler() *HealthHandler {
	return &HealthHandler{startedAt: time.Now().UTC()}
}

func (h *HealthHandler) Register(e *echo.Echo) {
	e.GET("/health", h.Get)
}

func (h *HealthHandler) Get(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{
		"status":     "ok",
		"started_at": h.startedAt.Format(time.RFC3339),
	})
}
