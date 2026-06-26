package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/xed/test-restaurant-onboarding/backend/internal/api"
	"github.com/xed/test-restaurant-onboarding/backend/internal/parse"
)

type mockParseService struct {
	legalFile       parse.UploadedFile
	legalResp       api.LegalParseResponse
	legalErr        error
	bankAccountFile parse.UploadedFile
	bankAccountResp api.BankAccountParseResponse
	bankAccountErr  error
	menuFiles       []parse.UploadedFile
	menuResp        api.MenuParseResponse
	menuErr         error
}

func (m *mockParseService) ParseLegal(_ context.Context, file parse.UploadedFile) (api.LegalParseResponse, error) {
	m.legalFile = file
	return m.legalResp, m.legalErr
}

func (m *mockParseService) ParseBankAccount(_ context.Context, file parse.UploadedFile) (api.BankAccountParseResponse, error) {
	m.bankAccountFile = file
	return m.bankAccountResp, m.bankAccountErr
}

func (m *mockParseService) ParseMenu(_ context.Context, files []parse.UploadedFile) (api.MenuParseResponse, error) {
	m.menuFiles = files
	return m.menuResp, m.menuErr
}

func TestParseLegalSuccess(t *testing.T) {
	service := &mockParseService{
		legalResp: api.LegalParseResponse{
			LegalName:           "SAVEURS DU SOLEIL LEVANT",
			SIREN:               "123456789",
			SIRET:               "12345678900012",
			LegalForm:           "SAS",
			LegalAddress:        "1 rue de test",
			LegalRepresentative: "Jane Doe",
		},
	}
	rec := executeMultipartRequest(t, NewParseHandler(service, nil), "kbis.pdf", "application/pdf", []byte("%PDF-1.7"))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, rec.Code, rec.Body.String())
	}

	var got api.LegalParseResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if got.LegalName != "SAVEURS DU SOLEIL LEVANT" {
		t.Fatalf("unexpected response: %+v", got)
	}
	if service.legalFile.Filename != "kbis.pdf" {
		t.Fatalf("expected uploaded filename, got %q", service.legalFile.Filename)
	}
	if service.legalFile.ContentType != "application/pdf" {
		t.Fatalf("expected content type application/pdf, got %q", service.legalFile.ContentType)
	}
}

func TestParseLegalMissingFile(t *testing.T) {
	e := echo.New()
	handler := NewParseHandler(&mockParseService{}, nil)
	handler.Register(e)

	req := httptest.NewRequest(http.MethodPost, "/parse/legal", bytes.NewReader(nil))
	req.Header.Set(echo.HeaderContentType, "multipart/form-data")
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadRequest, "missing_file")
}

func TestParseLegalServiceError(t *testing.T) {
	service := &mockParseService{legalErr: parse.ErrCouldNotParse}
	rec := executeMultipartRequest(t, NewParseHandler(service, nil), "kbis.pdf", "application/pdf", []byte("%PDF-1.7"))

	assertErrorResponse(t, rec, http.StatusUnprocessableEntity, "could_not_parse")
}

func TestParseLegalUnsupportedFileType(t *testing.T) {
	service := &mockParseService{}
	rec := executeMultipartRequest(t, NewParseHandler(service, nil), "notes.txt", "text/plain", []byte("hello"))

	assertErrorResponse(t, rec, http.StatusBadRequest, "unsupported_file_type")
}

func TestParseLegalFileTooLarge(t *testing.T) {
	service := &mockParseService{}
	rec := executeMultipartRequest(t, NewParseHandler(service, nil), "kbis.pdf", "application/pdf", bytes.Repeat([]byte("x"), maxUploadFileSize+1))

	assertErrorResponse(t, rec, http.StatusRequestEntityTooLarge, "file_too_large")
}

func TestParseLegalInvalidMultipartDoesNotPanic(t *testing.T) {
	e := echo.New()
	handler := NewParseHandler(&mockParseService{}, nil)
	handler.Register(e)

	req := httptest.NewRequest(http.MethodPost, "/parse/legal", bytes.NewReader([]byte("not multipart")))
	req.Header.Set(echo.HeaderContentType, "multipart/form-data; boundary=broken")
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadRequest, "missing_file")
}

func TestParseLegalGenericServiceErrorUsesParseErrorFormat(t *testing.T) {
	service := &mockParseService{legalErr: errors.New("unexpected parser failure")}
	rec := executeMultipartRequest(t, NewParseHandler(service, nil), "kbis.png", "image/png", []byte("png"))

	assertErrorResponse(t, rec, http.StatusUnprocessableEntity, "could_not_parse")
}

func TestParseBankAccountSuccess(t *testing.T) {
	service := &mockParseService{
		bankAccountResp: api.BankAccountParseResponse{
			AccountHolder: "SAVEURS DU SOLEIL LEVANT",
			BankName:      "BNP PARIBAS",
			IBAN:          "FR7612345678901234567890185",
			BIC:           "BNPAFRPP",
		},
	}
	rec := executeMultipartRequestToPath(t, NewParseHandler(service, nil), "/parse/bank_account", "rib.pdf", "application/pdf", []byte("%PDF-1.7"))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, rec.Code, rec.Body.String())
	}
	if bytes.Contains(rec.Body.Bytes(), []byte("account_number")) {
		t.Fatalf("response must not contain account_number: %s", rec.Body.String())
	}

	var got api.BankAccountParseResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if got.AccountHolder != "SAVEURS DU SOLEIL LEVANT" {
		t.Fatalf("unexpected response: %+v", got)
	}
	if service.bankAccountFile.Filename != "rib.pdf" {
		t.Fatalf("expected uploaded filename, got %q", service.bankAccountFile.Filename)
	}
}

func TestParseBankAccountServiceError(t *testing.T) {
	service := &mockParseService{bankAccountErr: parse.ErrCouldNotParse}
	rec := executeMultipartRequestToPath(t, NewParseHandler(service, nil), "/parse/bank_account", "rib.pdf", "application/pdf", []byte("%PDF-1.7"))

	assertErrorResponse(t, rec, http.StatusUnprocessableEntity, "could_not_parse")
}

func TestParseBankAccountMissingFile(t *testing.T) {
	e := echo.New()
	handler := NewParseHandler(&mockParseService{}, nil)
	handler.Register(e)

	req := httptest.NewRequest(http.MethodPost, "/parse/bank_account", bytes.NewReader(nil))
	req.Header.Set(echo.HeaderContentType, "multipart/form-data")
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadRequest, "missing_file")
}

func TestParseMenuSuccessMultipleFiles(t *testing.T) {
	service := &mockParseService{
		menuResp: api.MenuParseResponse{
			Menu: api.Menu{
				Items: []api.MenuItem{
					{
						ID:          "mains-ramen-1250",
						Price:       "12,50 €",
						Name:        "Ramen",
						Description: "",
						GroupName:   "Mains",
						Order:       0,
					},
					{
						ID:          "desserts-mochi",
						Price:       "",
						Name:        "Mochi",
						Description: "Assorted flavors",
						GroupName:   "Desserts",
						Order:       1,
					},
				},
			},
		},
	}

	rec := executeMultipartFilesRequest(t, NewParseHandler(service, nil), "/parse/menu", []testUpload{
		{filename: "menu-1.png", contentType: "image/png", content: []byte("png")},
		{filename: "menu-2.pdf", contentType: "application/pdf", content: []byte("%PDF-1.7")},
	})

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, rec.Code, rec.Body.String())
	}

	var got api.MenuParseResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(got.Menu.Items) != 2 {
		t.Fatalf("expected 2 items, got %+v", got)
	}
	item := got.Menu.Items[0]
	if item.ID == "" || item.Name == "" || item.Price != "12,50 €" || item.GroupName != "Mains" || item.Order != 0 {
		t.Fatalf("unexpected first item: %+v", item)
	}
	if got.Menu.Items[1].Price != "" {
		t.Fatalf("expected empty price to be preserved, got %+v", got.Menu.Items[1])
	}
	if len(service.menuFiles) != 2 {
		t.Fatalf("expected 2 uploaded files, got %d", len(service.menuFiles))
	}
}

func TestParseMenuSuccessSingleFile(t *testing.T) {
	service := &mockParseService{
		menuResp: api.MenuParseResponse{
			Menu: api.Menu{Items: []api.MenuItem{}},
		},
	}

	rec := executeMultipartFilesRequest(t, NewParseHandler(service, nil), "/parse/menu", []testUpload{
		{filename: "menu.pdf", contentType: "application/pdf", content: []byte("%PDF-1.7")},
	})

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, rec.Code, rec.Body.String())
	}
	if len(service.menuFiles) != 1 {
		t.Fatalf("expected one uploaded file, got %d", len(service.menuFiles))
	}

	var got api.MenuParseResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if got.Menu.Items == nil {
		t.Fatal("expected empty menu response shape to include items array")
	}
}

func TestParseMenuEmptyFiles(t *testing.T) {
	e := echo.New()
	handler := NewParseHandler(&mockParseService{}, nil)
	handler.Register(e)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/parse/menu", body)
	req.Header.Set(echo.HeaderContentType, writer.FormDataContentType())
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadRequest, "missing_files")
}

func TestParseMenuServiceError(t *testing.T) {
	service := &mockParseService{menuErr: parse.ErrCouldNotParse}
	rec := executeMultipartFilesRequest(t, NewParseHandler(service, nil), "/parse/menu", []testUpload{
		{filename: "menu.png", contentType: "image/png", content: []byte("png")},
	})

	assertErrorResponse(t, rec, http.StatusUnprocessableEntity, "could_not_parse")
}

func TestParseMenuUnsupportedFileType(t *testing.T) {
	service := &mockParseService{}
	rec := executeMultipartFilesRequest(t, NewParseHandler(service, nil), "/parse/menu", []testUpload{
		{filename: "menu.txt", contentType: "text/plain", content: []byte("menu")},
	})

	assertErrorResponse(t, rec, http.StatusBadRequest, "unsupported_file_type")
	if len(service.menuFiles) != 0 {
		t.Fatalf("parse service must not be called for unsupported files, got %d files", len(service.menuFiles))
	}
}

func TestParseMenuFileTooLarge(t *testing.T) {
	service := &mockParseService{}
	rec := executeMultipartFilesRequest(t, NewParseHandler(service, nil), "/parse/menu", []testUpload{
		{filename: "menu.png", contentType: "image/png", content: bytes.Repeat([]byte("x"), maxUploadFileSize+1)},
	})

	assertErrorResponse(t, rec, http.StatusRequestEntityTooLarge, "file_too_large")
}

func TestParseMenuInvalidMultipartDoesNotPanic(t *testing.T) {
	e := echo.New()
	handler := NewParseHandler(&mockParseService{}, nil)
	handler.Register(e)

	req := httptest.NewRequest(http.MethodPost, "/parse/menu", bytes.NewReader([]byte("not multipart")))
	req.Header.Set(echo.HeaderContentType, "multipart/form-data; boundary=broken")
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	assertErrorResponse(t, rec, http.StatusBadRequest, "missing_files")
}

type testUpload struct {
	filename    string
	contentType string
	content     []byte
}

func executeMultipartRequest(t *testing.T, handler *ParseHandler, filename, contentType string, content []byte) *httptest.ResponseRecorder {
	t.Helper()
	return executeMultipartRequestToPath(t, handler, "/parse/legal", filename, contentType, content)
}

func executeMultipartRequestToPath(t *testing.T, handler *ParseHandler, path, filename, contentType string, content []byte) *httptest.ResponseRecorder {
	t.Helper()
	return executeMultipartFilesRequestWithField(t, handler, path, "file", []testUpload{
		{filename: filename, contentType: contentType, content: content},
	})
}

func executeMultipartFilesRequest(t *testing.T, handler *ParseHandler, path string, uploads []testUpload) *httptest.ResponseRecorder {
	t.Helper()
	return executeMultipartFilesRequestWithField(t, handler, path, "files[]", uploads)
}

func executeMultipartFilesRequestWithField(t *testing.T, handler *ParseHandler, path, field string, uploads []testUpload) *httptest.ResponseRecorder {
	t.Helper()
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	for _, upload := range uploads {
		header := make(textproto.MIMEHeader)
		header.Set("Content-Disposition", `form-data; name="`+field+`"; filename="`+upload.filename+`"`)
		if upload.contentType != "" {
			header.Set("Content-Type", upload.contentType)
		}

		part, err := writer.CreatePart(header)
		if err != nil {
			t.Fatalf("create form file: %v", err)
		}
		if _, err := part.Write(upload.content); err != nil {
			t.Fatalf("write form file: %v", err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, path, body)
	req.Header.Set(echo.HeaderContentType, writer.FormDataContentType())

	e := echo.New()
	handler.Register(e)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func assertErrorResponse(t *testing.T, rec *httptest.ResponseRecorder, status int, code string) {
	t.Helper()

	if rec.Code != status {
		t.Fatalf("expected status %d, got %d: %s", status, rec.Code, rec.Body.String())
	}

	var got api.ParseErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode error response: %v", err)
	}
	if got.Error != code {
		t.Fatalf("expected error %q, got %+v", code, got)
	}
	if got.Message == "" {
		t.Fatal("expected non-empty error message")
	}
}
