package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/xed/test-restaurant-onboarding/backend/internal/config"
)

const defaultOpenAIBaseURL = "https://api.openai.com/v1"

const (
	openAIFilePurposeUserData = "user_data"
	openAIFilePurposeVision   = "vision"
)

type httpDoer interface {
	Do(req *http.Request) (*http.Response, error)
}

type openAIResponsesProvider struct {
	apiKey     string
	model      string
	baseURL    string
	timeout    time.Duration
	httpClient httpDoer
	logger     *slog.Logger
}

type openAIResponseInput struct {
	Role    string                      `json:"role"`
	Content []openAIResponseContentPart `json:"content"`
}

type openAIResponseContentPart struct {
	Type   string `json:"type"`
	Text   string `json:"text,omitempty"`
	FileID string `json:"file_id,omitempty"`
}

type openAIResponsesRequest struct {
	Model        string                `json:"model"`
	Instructions string                `json:"instructions"`
	Input        []openAIResponseInput `json:"input"`
	Text         openAITextConfig      `json:"text"`
}

type openAITextConfig struct {
	Format openAITextFormat `json:"format"`
}

type openAITextFormat struct {
	Type string `json:"type"`
}

type openAIResponsesResponse struct {
	OutputText string                 `json:"output_text"`
	Output     []openAIResponseOutput `json:"output"`
}

type openAIResponseOutput struct {
	Type    string                        `json:"type"`
	Content []openAIResponseOutputContent `json:"content"`
}

type openAIResponseOutputContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type openAIFileUploadResponse struct {
	ID string `json:"id"`
}

func NewOpenAIResponsesProvider(cfg config.OpenAIConfig, timeout time.Duration, logger *slog.Logger) (Provider, error) {
	if strings.TrimSpace(cfg.APIKey) == "" || strings.TrimSpace(cfg.Model) == "" {
		return nil, &ProviderError{
			Code:    "missing_llm_credentials",
			Message: "OPENAI_API_KEY and OPENAI_MODEL must be set for LLM_PROVIDER=openai",
			Err:     ErrMissingCredentials,
		}
	}
	if timeout <= 0 {
		timeout = 60 * time.Second
	}
	if logger == nil {
		logger = slog.Default()
	}

	baseURL := strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	if baseURL == "" {
		baseURL = defaultOpenAIBaseURL
	}

	return &openAIResponsesProvider{
		apiKey:     cfg.APIKey,
		model:      cfg.Model,
		baseURL:    baseURL,
		timeout:    timeout,
		httpClient: &http.Client{Timeout: timeout},
		logger:     logger,
	}, nil
}

func (p *openAIResponsesProvider) GenerateStructuredJSON(ctx context.Context, req StructuredRequest) ([]byte, error) {
	startedAt := time.Now()
	callCtx, cancel := context.WithTimeout(ctx, p.timeout)
	defer cancel()

	p.logger.Info(
		"llm request starting",
		"provider", ProviderOpenAI,
		"prompt_len", len(req.Prompt),
		"files_count", len(req.Files),
	)

	parts := []openAIResponseContentPart{{Type: "input_text", Text: req.Prompt}}
	uploadedFileIDs := make([]string, 0)

	for _, file := range req.Files {
		contentType := normalizedContentType(file)
		isImage := strings.HasPrefix(contentType, "image/")
		inputType := "input_file"
		purpose := openAIFilePurposeUserData
		if isImage {
			inputType = "input_image"
			purpose = openAIFilePurposeVision
		}

		fileID, err := p.uploadFile(callCtx, file, contentType, purpose)
		if err != nil {
			p.logger.Error("openai file upload failed", "duration_ms", time.Since(startedAt).Milliseconds(), "error", err)
			_ = p.deleteUploadedFiles(callCtx, uploadedFileIDs)
			return nil, providerFailed("LLM provider file upload failed", err)
		}
		uploadedFileIDs = append(uploadedFileIDs, fileID)
		p.logger.Info(
			"openai request file attached",
			"filename", file.Filename,
			"content_type", contentType,
			"size_bytes", len(file.Data),
			"input_type", inputType,
			"delivery", "files_api_upload",
			"purpose", purpose,
			"file_id", fileID,
			"is_image", isImage,
		)
		parts = append(parts, openAIResponseContentPart{Type: inputType, FileID: fileID})
	}

	raw, responseErr := p.createResponse(callCtx, parts)
	deleteErr := p.deleteUploadedFiles(callCtx, uploadedFileIDs)
	if responseErr != nil {
		p.logger.Error("openai responses request failed", "duration_ms", time.Since(startedAt).Milliseconds(), "error", responseErr)
		if deleteErr != nil {
			return nil, providerFailed("LLM provider request failed", fmt.Errorf("%w; cleanup failed: %v", responseErr, deleteErr))
		}
		return nil, providerFailed("LLM provider request failed", responseErr)
	}
	if deleteErr != nil {
		p.logger.Error("openai file cleanup failed", "duration_ms", time.Since(startedAt).Milliseconds(), "error", deleteErr)
		return nil, providerFailed("LLM provider cleanup failed", deleteErr)
	}

	p.logger.Info(
		"llm request completed",
		"provider", ProviderOpenAI,
		"duration_ms", time.Since(startedAt).Milliseconds(),
		"response_len", len(raw),
	)
	return raw, nil
}

func (p *openAIResponsesProvider) uploadFile(ctx context.Context, file File, contentType string, purpose string) (string, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	if err := writer.WriteField("purpose", purpose); err != nil {
		return "", err
	}

	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename="%s"`, escapeQuotes(file.Filename)))
	header.Set("Content-Type", contentType)
	part, err := writer.CreatePart(header)
	if err != nil {
		return "", err
	}
	if _, err := part.Write(file.Data); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, p.endpoint("files"), &body)
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)
	httpReq.Header.Set("Content-Type", writer.FormDataContentType())

	var out openAIFileUploadResponse
	if err := p.doJSON(httpReq, http.StatusOK, &out); err != nil {
		return "", err
	}
	if strings.TrimSpace(out.ID) == "" {
		return "", errorsNew("openai files response missing id")
	}
	return out.ID, nil
}

func (p *openAIResponsesProvider) createResponse(ctx context.Context, parts []openAIResponseContentPart) ([]byte, error) {
	payload := openAIResponsesRequest{
		Model:        p.model,
		Instructions: "Return only valid JSON. Do not include markdown, code fences, or explanations.",
		Input: []openAIResponseInput{
			{
				Role:    "user",
				Content: parts,
			},
		},
		Text: openAITextConfig{
			Format: openAITextFormat{Type: "json_object"},
		},
	}
	p.logger.Info("openai responses request payload", "payload", sanitizedPayloadJSON(payload))

	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, p.endpoint("responses"), bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	var out openAIResponsesResponse
	if err := p.doJSON(httpReq, http.StatusOK, &out); err != nil {
		return nil, err
	}
	text := strings.TrimSpace(out.OutputText)
	if text == "" {
		text = strings.TrimSpace(extractOutputText(out.Output))
	}
	if text == "" {
		return nil, errorsNew("openai responses response missing output text")
	}
	p.logger.Info("openai responses response", "response", text, "response_len", len(text))
	return []byte(text), nil
}

func (p *openAIResponsesProvider) deleteUploadedFiles(ctx context.Context, fileIDs []string) error {
	var cleanupErr error
	for _, fileID := range fileIDs {
		httpReq, err := http.NewRequestWithContext(ctx, http.MethodDelete, p.endpoint("files", fileID), nil)
		if err != nil {
			cleanupErr = errorsJoin(cleanupErr, err)
			continue
		}
		httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)

		if err := p.doJSON(httpReq, http.StatusOK, nil); err != nil {
			cleanupErr = errorsJoin(cleanupErr, err)
		}
	}
	return cleanupErr
}

func (p *openAIResponsesProvider) doJSON(req *http.Request, expectedStatus int, out any) error {
	resp, err := p.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode != expectedStatus {
		return fmt.Errorf("openai api returned status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	if out == nil || len(bytes.TrimSpace(body)) == 0 {
		return nil
	}
	if err := json.Unmarshal(body, out); err != nil {
		return err
	}
	return nil
}

func (p *openAIResponsesProvider) endpoint(parts ...string) string {
	base, err := url.Parse(p.baseURL)
	if err != nil {
		return strings.TrimRight(p.baseURL, "/") + "/" + strings.Join(parts, "/")
	}
	for _, part := range parts {
		base.Path = path.Join(base.Path, part)
	}
	return base.String()
}

func normalizedContentType(file File) string {
	contentType := strings.TrimSpace(file.ContentType)
	if contentType == "" {
		contentType = http.DetectContentType(file.Data)
	}
	if contentType == "" {
		return "application/octet-stream"
	}
	return contentType
}

func sanitizedPayloadJSON(payload openAIResponsesRequest) string {
	sanitized := payload
	sanitized.Input = make([]openAIResponseInput, len(payload.Input))
	for inputIndex, input := range payload.Input {
		sanitized.Input[inputIndex] = openAIResponseInput{
			Role:    input.Role,
			Content: make([]openAIResponseContentPart, len(input.Content)),
		}
		copy(sanitized.Input[inputIndex].Content, input.Content)
	}

	data, err := json.Marshal(sanitized)
	if err != nil {
		return fmt.Sprintf("could not marshal sanitized OpenAI request payload: %v", err)
	}
	return string(data)
}

func extractOutputText(output []openAIResponseOutput) string {
	var builder strings.Builder
	for _, item := range output {
		for _, content := range item.Content {
			if content.Type == "output_text" || content.Type == "text" {
				builder.WriteString(content.Text)
			}
		}
	}
	return builder.String()
}

func escapeQuotes(value string) string {
	return strings.ReplaceAll(value, `"`, `\"`)
}

func providerFailed(message string, err error) error {
	return &ProviderError{
		Code:    "llm_provider_failed",
		Message: message,
		Err:     fmt.Errorf("%w: %v", ErrProviderFailed, err),
	}
}

func errorsNew(message string) error {
	return errors.New(message)
}

func errorsJoin(left error, right error) error {
	return errors.Join(left, right)
}
