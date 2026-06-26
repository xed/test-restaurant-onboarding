package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	einomodel "github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
	"github.com/xed/test-restaurant-onboarding/backend/internal/config"
)

type fakeChatModel struct {
	messages []*schema.Message
	resp     *schema.Message
	err      error
}

func (m *fakeChatModel) Generate(_ context.Context, input []*schema.Message, _ ...einomodel.Option) (*schema.Message, error) {
	m.messages = input
	return m.resp, m.err
}

func TestEinoProviderGenerateStructuredJSON(t *testing.T) {
	model := &fakeChatModel{resp: schema.AssistantMessage(`{"ok":true}`, nil)}
	provider := NewEinoProvider(ProviderOpenAI, model, time.Second, slog.Default())

	out, err := provider.GenerateStructuredJSON(context.Background(), StructuredRequest{
		Prompt: "Return JSON.",
		Files: []File{
			{
				Filename:    "menu.png",
				ContentType: "image/png",
				Data:        []byte("image bytes"),
			},
		},
	})
	if err != nil {
		t.Fatalf("GenerateStructuredJSON returned error: %v", err)
	}
	if string(out) != `{"ok":true}` {
		t.Fatalf("unexpected response: %s", out)
	}
	if len(model.messages) != 2 {
		t.Fatalf("expected system and user messages, got %d", len(model.messages))
	}

	parts := model.messages[1].UserInputMultiContent
	if len(parts) != 2 {
		t.Fatalf("expected prompt plus image part, got %d", len(parts))
	}
	if parts[1].Type != schema.ChatMessagePartTypeImageURL {
		t.Fatalf("expected image to be sent as image part, got %q", parts[1].Type)
	}
}

func TestEinoProviderExtractsPDFTextAsTextPart(t *testing.T) {
	model := &fakeChatModel{resp: schema.AssistantMessage(`{"ok":true}`, nil)}
	provider := NewEinoProvider(ProviderOpenAI, model, time.Second, slog.Default())

	_, err := provider.GenerateStructuredJSON(context.Background(), StructuredRequest{
		Prompt: "Return JSON.",
		Files: []File{
			{
				Filename:    "mock_kbis.pdf",
				ContentType: "application/pdf",
				Data:        readTestFile(t, "../../../.examples/mock_kbis.pdf"),
			},
		},
	})
	if err != nil {
		t.Fatalf("GenerateStructuredJSON returned error: %v", err)
	}

	parts := model.messages[1].UserInputMultiContent
	if len(parts) != 2 {
		t.Fatalf("expected prompt plus extracted PDF text, got %d", len(parts))
	}
	if parts[1].Type != schema.ChatMessagePartTypeText {
		t.Fatalf("expected PDF to be sent as text part, got %q", parts[1].Type)
	}
	if strings.Contains(string(parts[1].Type), "file_url") {
		t.Fatal("PDF must not be sent as file_url")
	}
	if !strings.Contains(parts[1].Text, "Uploaded PDF") {
		t.Fatalf("expected extracted PDF text marker, got %q", parts[1].Text)
	}
}

func TestEinoProviderRejectsPDFWithoutReadableText(t *testing.T) {
	model := &fakeChatModel{resp: schema.AssistantMessage(`{"ok":true}`, nil)}
	provider := NewEinoProvider(ProviderOpenAI, model, time.Second, slog.Default())

	_, err := provider.GenerateStructuredJSON(context.Background(), StructuredRequest{
		Prompt: "Return JSON.",
		Files: []File{
			{
				Filename:    "broken.pdf",
				ContentType: "application/pdf",
				Data:        []byte("not a pdf"),
			},
		},
	})
	if err == nil {
		t.Fatal("expected error")
	}
	if !errors.Is(err, ErrProviderFailed) {
		t.Fatalf("expected ErrProviderFailed, got %v", err)
	}
	if model.messages != nil {
		t.Fatal("model should not be called when PDF text extraction fails")
	}
}

func TestOpenAIResponsesProviderUploadsPDFAsInputFileAndDeletesAfterSuccess(t *testing.T) {
	server := newOpenAITestServer(t, openAITestServerOptions{
		responseBody: `{"output_text":"{\"ok\":true}"}`,
	})
	provider := newOpenAITestProvider(t, server.URL)

	out, err := provider.GenerateStructuredJSON(context.Background(), StructuredRequest{
		Prompt: "Return JSON.",
		Files: []File{
			{
				Filename:    "mock_kbis.pdf",
				ContentType: "application/pdf",
				Data:        []byte("%PDF bytes"),
			},
		},
	})
	if err != nil {
		t.Fatalf("GenerateStructuredJSON returned error: %v", err)
	}
	if string(out) != `{"ok":true}` {
		t.Fatalf("unexpected response: %s", out)
	}
	if len(server.uploads) != 1 {
		t.Fatalf("expected one file upload, got %d", len(server.uploads))
	}
	if server.uploads[0].purpose != "user_data" {
		t.Fatalf("expected purpose=user_data, got %q", server.uploads[0].purpose)
	}
	if !server.responsesHasPart("input_file", "file_id", "file-test-1") {
		t.Fatalf("expected Responses request input_file with uploaded file_id, got %+v", server.responses)
	}
	if server.responsesContainsText("Uploaded PDF") {
		t.Fatal("Responses request must not contain extracted PDF text marker")
	}
	if got := strings.Join(server.deletes, ","); got != "file-test-1" {
		t.Fatalf("expected uploaded file to be deleted, got %q", got)
	}
}

func TestOpenAIResponsesProviderSendsImagesAsInputImage(t *testing.T) {
	server := newOpenAITestServer(t, openAITestServerOptions{
		responseBody: `{"output":[{"type":"message","content":[{"type":"output_text","text":"{\"ok\":true}"}]}]}`,
	})
	provider := newOpenAITestProvider(t, server.URL)

	_, err := provider.GenerateStructuredJSON(context.Background(), StructuredRequest{
		Prompt: "Return JSON.",
		Files: []File{
			{
				Filename:    "menu.png",
				ContentType: "image/png",
				Data:        []byte("png bytes"),
			},
		},
	})
	if err != nil {
		t.Fatalf("GenerateStructuredJSON returned error: %v", err)
	}
	if len(server.uploads) != 0 {
		t.Fatalf("expected image not to be uploaded through Files API, got %d uploads", len(server.uploads))
	}
	if !server.responsesHasImageDataURL("data:image/png;base64,") {
		t.Fatalf("expected input_image data URL, got %+v", server.responses)
	}
}

func TestOpenAIResponsesProviderSendsMultipleFilesInOneResponsesRequest(t *testing.T) {
	server := newOpenAITestServer(t, openAITestServerOptions{
		responseBody: `{"output_text":"{\"menu\":{\"items\":[]}}"}`,
	})
	provider := newOpenAITestProvider(t, server.URL)

	_, err := provider.GenerateStructuredJSON(context.Background(), StructuredRequest{
		Prompt: "Return menu JSON.",
		Files: []File{
			{Filename: "menu-1.pdf", ContentType: "application/pdf", Data: []byte("pdf 1")},
			{Filename: "menu-2.pdf", ContentType: "application/pdf", Data: []byte("pdf 2")},
			{Filename: "menu-3.png", ContentType: "image/png", Data: []byte("png")},
		},
	})
	if err != nil {
		t.Fatalf("GenerateStructuredJSON returned error: %v", err)
	}
	if len(server.responses) != 1 {
		t.Fatalf("expected one Responses API request, got %d", len(server.responses))
	}
	if len(server.uploads) != 2 {
		t.Fatalf("expected two Files API uploads, got %d", len(server.uploads))
	}
	if !server.responsesHasPart("input_file", "file_id", "file-test-1") ||
		!server.responsesHasPart("input_file", "file_id", "file-test-2") ||
		!server.responsesHasImageDataURL("data:image/png;base64,") {
		t.Fatalf("expected two file parts and one image part, got %+v", server.responses)
	}
	if got := strings.Join(server.deletes, ","); got != "file-test-1,file-test-2" {
		t.Fatalf("expected both uploaded files to be deleted, got %q", got)
	}
}

func TestOpenAIResponsesProviderDeletesUploadedFileAfterModelError(t *testing.T) {
	server := newOpenAITestServer(t, openAITestServerOptions{
		responseStatus: http.StatusInternalServerError,
		responseBody:   `{"error":{"message":"upstream"}}`,
	})
	provider := newOpenAITestProvider(t, server.URL)

	_, err := provider.GenerateStructuredJSON(context.Background(), StructuredRequest{
		Prompt: "Return JSON.",
		Files:  []File{{Filename: "rib.pdf", ContentType: "application/pdf", Data: []byte("pdf")}},
	})
	if err == nil {
		t.Fatal("expected error")
	}
	if !errors.Is(err, ErrProviderFailed) {
		t.Fatalf("expected ErrProviderFailed, got %v", err)
	}
	if got := strings.Join(server.deletes, ","); got != "file-test-1" {
		t.Fatalf("expected uploaded file cleanup after response error, got %q", got)
	}
}

func TestOpenAIResponsesProviderReturnsControlledErrorOnDeleteFailure(t *testing.T) {
	server := newOpenAITestServer(t, openAITestServerOptions{
		responseBody: `{"output_text":"{\"ok\":true}"}`,
		deleteStatus: http.StatusInternalServerError,
		deleteBody:   `{"error":{"message":"cleanup"}}`,
	})
	provider := newOpenAITestProvider(t, server.URL)

	_, err := provider.GenerateStructuredJSON(context.Background(), StructuredRequest{
		Prompt: "Return JSON.",
		Files:  []File{{Filename: "kbis.pdf", ContentType: "application/pdf", Data: []byte("pdf")}},
	})
	if err == nil {
		t.Fatal("expected error")
	}
	if !errors.Is(err, ErrProviderFailed) {
		t.Fatalf("expected ErrProviderFailed, got %v", err)
	}
}

func TestOpenAIResponsesProviderLogsUploadPayloadAndResponseWithoutImageBase64(t *testing.T) {
	server := newOpenAITestServer(t, openAITestServerOptions{
		responseBody: `{"output_text":"{\"legal_name\":\"KOYUKI\"}"}`,
	})
	var logs bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logs, &slog.HandlerOptions{Level: slog.LevelDebug}))
	provider := newOpenAITestProviderWithLogger(t, server.URL, logger)

	_, err := provider.GenerateStructuredJSON(context.Background(), StructuredRequest{
		Prompt: "Return JSON.",
		Files: []File{
			{Filename: "kbis.pdf", ContentType: "application/pdf", Data: []byte("pdf bytes")},
			{Filename: "kbis.png", ContentType: "image/png", Data: []byte("png bytes")},
		},
	})
	if err != nil {
		t.Fatalf("GenerateStructuredJSON returned error: %v", err)
	}

	got := logs.String()
	for _, want := range []string{
		"openai file uploaded",
		"file-test-1",
		"openai responses request payload",
		`\"file_id\":\"file-test-1\"`,
		`\"image_url\":\"[base64 image omitted]\"`,
		"openai responses response",
		`{\"legal_name\":\"KOYUKI\"}`,
	} {
		if !strings.Contains(got, want) {
			t.Fatalf("expected logs to contain %q, got %s", want, got)
		}
	}
	if strings.Contains(got, "data:image/png;base64,") || strings.Contains(got, "cG5nIGJ5dGVz") {
		t.Fatalf("logs must not contain image data URL/base64, got %s", got)
	}
}

func TestEinoProviderWrapsModelError(t *testing.T) {
	model := &fakeChatModel{err: errors.New("upstream down")}
	provider := NewEinoProvider(ProviderOpenAI, model, time.Second, slog.Default())

	_, err := provider.GenerateStructuredJSON(context.Background(), StructuredRequest{Prompt: "Return JSON."})
	if err == nil {
		t.Fatal("expected error")
	}
	if !errors.Is(err, ErrProviderFailed) {
		t.Fatalf("expected ErrProviderFailed, got %v", err)
	}
}

func readTestFile(t *testing.T, path string) []byte {
	t.Helper()

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read test file %s: %v", path, err)
	}
	return data
}

func TestNewProviderSelectsOpenAIAndAnthropic(t *testing.T) {
	_, err := NewProvider(context.Background(), config.Config{LLMProvider: ProviderOpenAI}, slog.Default())
	if !errors.Is(err, ErrMissingCredentials) {
		t.Fatalf("expected missing credentials for openai, got %v", err)
	}

	anthropicProvider, err := NewProvider(context.Background(), config.Config{
		LLMProvider: ProviderAnthropic,
		Anthropic: config.AnthropicConfig{
			APIKey: "test-key",
			Model:  "claude-test",
		},
	}, slog.Default())
	if err != nil {
		t.Fatalf("expected anthropic provider to be configured: %v", err)
	}

	_, err = anthropicProvider.GenerateStructuredJSON(context.Background(), StructuredRequest{Prompt: "Return JSON."})
	if !errors.Is(err, ErrProviderFailed) {
		t.Fatalf("expected controlled provider failure for anthropic adapter, got %v", err)
	}
}

func TestNewProviderRejectsUnknownProvider(t *testing.T) {
	_, err := NewProvider(context.Background(), config.Config{LLMProvider: "other"}, slog.Default())
	if !errors.Is(err, ErrUnknownProvider) {
		t.Fatalf("expected ErrUnknownProvider, got %v", err)
	}
}

type openAITestServerOptions struct {
	responseStatus int
	responseBody   string
	deleteStatus   int
	deleteBody     string
}

type openAITestServer struct {
	*httptest.Server
	uploads   []openAITestUpload
	responses []map[string]any
	deletes   []string
	options   openAITestServerOptions
}

type openAITestUpload struct {
	purpose     string
	filename    string
	contentType string
	body        []byte
}

func newOpenAITestServer(t *testing.T, options openAITestServerOptions) *openAITestServer {
	t.Helper()

	state := &openAITestServer{options: options}
	state.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/v1/files":
			fileID := state.handleFileUpload(t, w, r)
			_ = json.NewEncoder(w).Encode(map[string]string{"id": fileID})
		case r.Method == http.MethodPost && r.URL.Path == "/v1/responses":
			state.handleResponse(t, w, r)
		case r.Method == http.MethodDelete && strings.HasPrefix(r.URL.Path, "/v1/files/"):
			state.handleDelete(w, strings.TrimPrefix(r.URL.Path, "/v1/files/"))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(state.Close)
	return state
}

func (s *openAITestServer) handleFileUpload(t *testing.T, w http.ResponseWriter, r *http.Request) string {
	t.Helper()
	if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
		t.Fatalf("unexpected authorization header: %q", got)
	}
	if err := r.ParseMultipartForm(20 << 20); err != nil {
		t.Fatalf("ParseMultipartForm: %v", err)
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		t.Fatalf("FormFile: %v", err)
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}
	s.uploads = append(s.uploads, openAITestUpload{
		purpose:     r.FormValue("purpose"),
		filename:    header.Filename,
		contentType: header.Header.Get("Content-Type"),
		body:        data,
	})
	return fmt.Sprintf("file-test-%d", len(s.uploads))
}

func (s *openAITestServer) handleResponse(t *testing.T, w http.ResponseWriter, r *http.Request) {
	t.Helper()
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		t.Fatalf("Decode response request: %v", err)
	}
	s.responses = append(s.responses, body)

	status := s.options.responseStatus
	if status == 0 {
		status = http.StatusOK
	}
	w.WriteHeader(status)
	bodyText := s.options.responseBody
	if bodyText == "" {
		bodyText = `{"output_text":"{\"ok\":true}"}`
	}
	_, _ = w.Write([]byte(bodyText))
}

func (s *openAITestServer) handleDelete(w http.ResponseWriter, fileID string) {
	s.deletes = append(s.deletes, fileID)
	status := s.options.deleteStatus
	if status == 0 {
		status = http.StatusOK
	}
	w.WriteHeader(status)
	bodyText := s.options.deleteBody
	if bodyText == "" {
		bodyText = `{"deleted":true}`
	}
	_, _ = w.Write([]byte(bodyText))
}

func (s *openAITestServer) responsesHasPart(partType string, key string, value string) bool {
	for _, request := range s.responses {
		for _, part := range responseContentParts(request) {
			if part["type"] == partType && part[key] == value {
				return true
			}
		}
	}
	return false
}

func (s *openAITestServer) responsesHasImageDataURL(prefix string) bool {
	for _, request := range s.responses {
		for _, part := range responseContentParts(request) {
			if part["type"] == "input_image" {
				if imageURL, ok := part["image_url"].(string); ok && strings.HasPrefix(imageURL, prefix) {
					return true
				}
			}
		}
	}
	return false
}

func (s *openAITestServer) responsesContainsText(value string) bool {
	for _, request := range s.responses {
		for _, part := range responseContentParts(request) {
			if text, ok := part["text"].(string); ok && strings.Contains(text, value) {
				return true
			}
		}
	}
	return false
}

func responseContentParts(request map[string]any) []map[string]any {
	var parts []map[string]any
	inputs, _ := request["input"].([]any)
	for _, input := range inputs {
		inputMap, _ := input.(map[string]any)
		content, _ := inputMap["content"].([]any)
		for _, item := range content {
			part, _ := item.(map[string]any)
			if part != nil {
				parts = append(parts, part)
			}
		}
	}
	return parts
}

func newOpenAITestProvider(t *testing.T, baseURL string) Provider {
	t.Helper()
	return newOpenAITestProviderWithLogger(t, baseURL, slog.Default())
}

func newOpenAITestProviderWithLogger(t *testing.T, baseURL string, logger *slog.Logger) Provider {
	t.Helper()
	provider, err := NewOpenAIResponsesProvider(config.OpenAIConfig{
		APIKey:  "test-key",
		Model:   "gpt-test",
		BaseURL: baseURL + "/v1",
	}, time.Second, logger)
	if err != nil {
		t.Fatalf("NewOpenAIResponsesProvider: %v", err)
	}
	return provider
}
