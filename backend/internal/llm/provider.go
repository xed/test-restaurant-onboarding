package llm

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"strings"
	"time"

	einoopenai "github.com/cloudwego/eino-ext/components/model/openai"
	einomodel "github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
	"github.com/ledongthuc/pdf"
	"github.com/xed/test-restaurant-onboarding/backend/internal/config"
)

const (
	ProviderOpenAI    = "openai"
	ProviderAnthropic = "anthropic"

	maxExtractedPDFTextBytes = 200 << 10
)

var (
	ErrUnknownProvider     = errors.New("unknown_llm_provider")
	ErrMissingProvider     = errors.New("missing_llm_provider")
	ErrMissingCredentials  = errors.New("missing_llm_credentials")
	ErrProviderUnavailable = errors.New("llm_provider_unavailable")
	ErrProviderFailed      = errors.New("llm_provider_failed")
)

type File struct {
	Filename    string
	ContentType string
	Data        []byte
}

type StructuredRequest struct {
	Prompt string
	Files  []File
}

type Provider interface {
	GenerateStructuredJSON(ctx context.Context, req StructuredRequest) ([]byte, error)
}

type ProviderError struct {
	Code    string
	Message string
	Err     error
}

func (e *ProviderError) Error() string {
	if e == nil {
		return ""
	}
	if e.Message != "" {
		return e.Message
	}
	return e.Code
}

func (e *ProviderError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

type EinoChatModel interface {
	Generate(ctx context.Context, input []*schema.Message, opts ...einomodel.Option) (*schema.Message, error)
}

type provider struct {
	name    string
	model   EinoChatModel
	timeout time.Duration
	logger  *slog.Logger
}

func NewProvider(ctx context.Context, cfg config.Config, logger *slog.Logger) (Provider, error) {
	if logger == nil {
		logger = slog.Default()
	}

	switch strings.ToLower(strings.TrimSpace(cfg.LLMProvider)) {
	case "":
		return nil, &ProviderError{
			Code:    "missing_llm_provider",
			Message: "LLM_PROVIDER must be set to openai or anthropic",
			Err:     ErrMissingProvider,
		}
	case ProviderOpenAI:
		provider, err := NewOpenAIResponsesProvider(cfg.OpenAI, cfg.LLMTimeout, logger)
		if err != nil {
			return nil, err
		}
		return provider, nil
	case ProviderAnthropic:
		model, err := newAnthropicChatModel(cfg.Anthropic)
		if err != nil {
			return nil, err
		}
		return NewEinoProvider(ProviderAnthropic, model, cfg.LLMTimeout, logger), nil
	default:
		return nil, &ProviderError{
			Code:    "unknown_llm_provider",
			Message: "LLM_PROVIDER must be set to openai or anthropic",
			Err:     ErrUnknownProvider,
		}
	}
}

func NewEinoProvider(name string, model EinoChatModel, timeout time.Duration, logger *slog.Logger) Provider {
	if timeout <= 0 {
		timeout = 60 * time.Second
	}
	if logger == nil {
		logger = slog.Default()
	}
	return &provider{name: name, model: model, timeout: timeout, logger: logger}
}

func (p *provider) GenerateStructuredJSON(ctx context.Context, req StructuredRequest) ([]byte, error) {
	if p.model == nil {
		return nil, &ProviderError{
			Code:    "llm_provider_unavailable",
			Message: "LLM provider is not configured",
			Err:     ErrProviderUnavailable,
		}
	}

	startedAt := time.Now()
	callCtx, cancel := context.WithTimeout(ctx, p.timeout)
	defer cancel()

	p.logger.Info(
		"llm request starting",
		"provider", p.name,
		"prompt_len", len(req.Prompt),
		"files_count", len(req.Files),
	)

	messages, err := buildMessages(req)
	if err != nil {
		p.logger.Error(
			"llm request build failed",
			"provider", p.name,
			"duration_ms", time.Since(startedAt).Milliseconds(),
			"error", err,
		)
		return nil, &ProviderError{
			Code:    "llm_provider_failed",
			Message: "LLM provider request could not be built",
			Err:     ErrProviderFailed,
		}
	}

	resp, err := p.model.Generate(callCtx, messages)
	if err != nil {
		p.logger.Error(
			"llm request failed",
			"provider", p.name,
			"duration_ms", time.Since(startedAt).Milliseconds(),
			"error", err,
		)
		return nil, &ProviderError{
			Code:    "llm_provider_failed",
			Message: "LLM provider request failed",
			Err:     ErrProviderFailed,
		}
	}
	if resp == nil {
		return nil, &ProviderError{
			Code:    "llm_provider_failed",
			Message: "LLM provider returned an empty response",
			Err:     ErrProviderFailed,
		}
	}

	p.logger.Info(
		"llm request completed",
		"provider", p.name,
		"duration_ms", time.Since(startedAt).Milliseconds(),
		"response_len", len(resp.Content),
	)
	return []byte(resp.Content), nil
}

func buildMessages(req StructuredRequest) ([]*schema.Message, error) {
	parts := []schema.MessageInputPart{
		{
			Type: schema.ChatMessagePartTypeText,
			Text: req.Prompt,
		},
	}

	for _, file := range req.Files {
		contentType := strings.TrimSpace(file.ContentType)
		if contentType == "" {
			contentType = "application/octet-stream"
		}

		if strings.HasPrefix(contentType, "image/") {
			parts = append(parts, imagePart(file, contentType))
			continue
		}

		if isPDFFile(file) {
			text, err := extractPDFText(file)
			if err != nil {
				return nil, err
			}
			parts = append(parts, schema.MessageInputPart{
				Type: schema.ChatMessagePartTypeText,
				Text: fmt.Sprintf(
					"Uploaded PDF %q (%s) extracted text:\n%s",
					file.Filename,
					contentType,
					text,
				),
			})
			continue
		}

		return nil, fmt.Errorf("unsupported file content type for OpenAI chat model: %s", contentType)
	}

	return []*schema.Message{
		schema.SystemMessage("Return only valid JSON. Do not include markdown, code fences, or explanations."),
		{
			Role:                  schema.User,
			UserInputMultiContent: parts,
		},
	}, nil
}

func isPDFFile(file File) bool {
	contentType := strings.ToLower(strings.TrimSpace(file.ContentType))
	if contentType == "application/pdf" {
		return true
	}
	return strings.HasSuffix(strings.ToLower(file.Filename), ".pdf") &&
		(contentType == "" || contentType == "application/octet-stream")
}

func extractPDFText(file File) (string, error) {
	reader, err := pdf.NewReader(bytes.NewReader(file.Data), int64(len(file.Data)))
	if err != nil {
		return "", fmt.Errorf("read pdf %q: %w", file.Filename, err)
	}

	textReader, err := reader.GetPlainText()
	if err != nil {
		return "", fmt.Errorf("extract pdf text %q: %w", file.Filename, err)
	}

	data, err := io.ReadAll(io.LimitReader(textReader, maxExtractedPDFTextBytes+1))
	if err != nil {
		return "", fmt.Errorf("read extracted pdf text %q: %w", file.Filename, err)
	}

	text := strings.TrimSpace(string(data))
	if len(data) > maxExtractedPDFTextBytes {
		text = strings.TrimSpace(string(data[:maxExtractedPDFTextBytes]))
	}
	if text == "" {
		return "", fmt.Errorf("extract pdf text %q: no text layer found", file.Filename)
	}
	return text, nil
}

func imagePart(file File, contentType string) schema.MessageInputPart {
	return schema.MessageInputPart{
		Type: schema.ChatMessagePartTypeImageURL,
		Image: &schema.MessageInputImage{
			MessagePartCommon: schema.MessagePartCommon{
				Base64Data: ptr(base64.StdEncoding.EncodeToString(file.Data)),
				MIMEType:   contentType,
			},
			Detail: schema.ImageURLDetailAuto,
		},
	}
}

func newOpenAIChatModel(ctx context.Context, cfg config.OpenAIConfig, timeout time.Duration) (EinoChatModel, error) {
	if strings.TrimSpace(cfg.APIKey) == "" || strings.TrimSpace(cfg.Model) == "" {
		return nil, &ProviderError{
			Code:    "missing_llm_credentials",
			Message: "OPENAI_API_KEY and OPENAI_MODEL must be set for LLM_PROVIDER=openai",
			Err:     ErrMissingCredentials,
		}
	}

	return einoopenai.NewChatModel(ctx, &einoopenai.ChatModelConfig{
		APIKey:  cfg.APIKey,
		Model:   cfg.Model,
		BaseURL: cfg.BaseURL,
		Timeout: timeout,
		ResponseFormat: &einoopenai.ChatCompletionResponseFormat{
			Type: einoopenai.ChatCompletionResponseFormatTypeJSONObject,
		},
	})
}

func newAnthropicChatModel(cfg config.AnthropicConfig) (EinoChatModel, error) {
	if strings.TrimSpace(cfg.APIKey) == "" || strings.TrimSpace(cfg.Model) == "" {
		return nil, &ProviderError{
			Code:    "missing_llm_credentials",
			Message: "ANTHROPIC_API_KEY and ANTHROPIC_MODEL must be set for LLM_PROVIDER=anthropic",
			Err:     ErrMissingCredentials,
		}
	}

	return &anthropicChatModel{
		apiKey:  cfg.APIKey,
		model:   cfg.Model,
		baseURL: cfg.BaseURL,
	}, nil
}

type anthropicChatModel struct {
	apiKey  string
	model   string
	baseURL string
}

func (m *anthropicChatModel) Generate(context.Context, []*schema.Message, ...einomodel.Option) (*schema.Message, error) {
	return nil, fmt.Errorf("%w: anthropic Eino-compatible adapter is configured but real Anthropic transport is not implemented yet", ErrProviderUnavailable)
}

func ptr[T any](value T) *T {
	return &value
}
