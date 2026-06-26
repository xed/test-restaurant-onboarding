package config

import (
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	defaultPort            = "8080"
	defaultShutdownTimeout = 10 * time.Second
	defaultReadTimeout     = 10 * time.Second
	defaultWriteTimeout    = 240 * time.Second
	defaultLLMTimeout      = 180 * time.Second
)

type Config struct {
	Addr            string
	Port            string
	LogLevel        slog.Level
	LLMProvider     string
	LLMTimeout      time.Duration
	OpenAI          OpenAIConfig
	Anthropic       AnthropicConfig
	ShutdownTimeout time.Duration
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
}

type OpenAIConfig struct {
	APIKey  string
	Model   string
	BaseURL string
}

type AnthropicConfig struct {
	APIKey  string
	Model   string
	BaseURL string
}

func Load() Config {
	port := getenv("PORT", defaultPort)

	return Config{
		Addr:            ":" + port,
		Port:            port,
		LogLevel:        parseLogLevel(getenv("LOG_LEVEL", "info")),
		LLMProvider:     strings.ToLower(getenv("LLM_PROVIDER", "")),
		LLMTimeout:      durationFromEnv("LLM_TIMEOUT", defaultLLMTimeout),
		OpenAI:          loadOpenAIConfig(),
		Anthropic:       loadAnthropicConfig(),
		ShutdownTimeout: durationFromEnv("SHUTDOWN_TIMEOUT", defaultShutdownTimeout),
		ReadTimeout:     durationFromEnv("READ_TIMEOUT", defaultReadTimeout),
		WriteTimeout:    durationFromEnv("WRITE_TIMEOUT", defaultWriteTimeout),
	}
}

func loadOpenAIConfig() OpenAIConfig {
	return OpenAIConfig{
		APIKey:  getenv("OPENAI_API_KEY", ""),
		Model:   getenv("OPENAI_MODEL", ""),
		BaseURL: getenv("OPENAI_BASE_URL", ""),
	}
}

func loadAnthropicConfig() AnthropicConfig {
	return AnthropicConfig{
		APIKey:  getenv("ANTHROPIC_API_KEY", ""),
		Model:   getenv("ANTHROPIC_MODEL", ""),
		BaseURL: getenv("ANTHROPIC_BASE_URL", ""),
	}
}

func getenv(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func durationFromEnv(key string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}

	if parsed, err := time.ParseDuration(raw); err == nil {
		return parsed
	}

	seconds, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return time.Duration(seconds) * time.Second
}

func parseLogLevel(raw string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
