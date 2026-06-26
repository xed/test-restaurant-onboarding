package handlers

import (
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/xed/test-restaurant-onboarding/backend/internal/api"
	"github.com/xed/test-restaurant-onboarding/backend/internal/parse"
)

const maxUploadFileSize = 20 << 20

var errFileTooLarge = errors.New("file_too_large")

type ParseHandler struct {
	service parse.Service
	logger  *slog.Logger
}

func NewParseHandler(service parse.Service, logger *slog.Logger) *ParseHandler {
	return &ParseHandler{service: service, logger: logger}
}

func (h *ParseHandler) Register(e *echo.Echo) {
	group := e.Group("/parse")
	group.POST("/legal", h.ParseLegal)
	group.POST("/bank_account", h.ParseBankAccount)
	group.POST("/menu", h.ParseMenu)
}

func (h *ParseHandler) ParseLegal(c echo.Context) error {
	file, err := readSingleFile(c, "file")
	if err != nil {
		if errors.Is(err, errFileTooLarge) {
			return fileTooLargeResponse(c)
		}
		return c.JSON(http.StatusBadRequest, api.ParseErrorResponse{
			Error:   "missing_file",
			Message: `multipart field "file" is required`,
		})
	}

	if !isPDFOrImage(file) {
		return c.JSON(http.StatusBadRequest, api.ParseErrorResponse{
			Error:   "unsupported_file_type",
			Message: "file must be a PDF or image",
		})
	}

	if h.service == nil {
		return c.JSON(http.StatusUnprocessableEntity, api.ParseErrorResponse{
			Error:   "could_not_parse",
			Message: "parse service is not configured",
		})
	}

	out, err := h.service.ParseLegal(c.Request().Context(), file)
	if err != nil {
		if h.logger != nil {
			h.logger.Warn("legal parse failed", "error", err)
		}
		message := "could not parse document"
		if errors.Is(err, parse.ErrCouldNotParse) && err.Error() != "" {
			message = err.Error()
		}
		return c.JSON(http.StatusUnprocessableEntity, api.ParseErrorResponse{
			Error:   "could_not_parse",
			Message: message,
		})
	}

	return c.JSON(http.StatusOK, out)
}

func (h *ParseHandler) ParseBankAccount(c echo.Context) error {
	file, err := readSingleFile(c, "file")
	if err != nil {
		if errors.Is(err, errFileTooLarge) {
			return fileTooLargeResponse(c)
		}
		return c.JSON(http.StatusBadRequest, api.ParseErrorResponse{
			Error:   "missing_file",
			Message: `multipart field "file" is required`,
		})
	}

	if !isPDFOrImage(file) {
		return c.JSON(http.StatusBadRequest, api.ParseErrorResponse{
			Error:   "unsupported_file_type",
			Message: "file must be a PDF or image",
		})
	}

	if h.service == nil {
		return c.JSON(http.StatusUnprocessableEntity, api.ParseErrorResponse{
			Error:   "could_not_parse",
			Message: "parse service is not configured",
		})
	}

	out, err := h.service.ParseBankAccount(c.Request().Context(), file)
	if err != nil {
		if h.logger != nil {
			h.logger.Warn("bank account parse failed", "error", err)
		}
		message := "could not parse document"
		if errors.Is(err, parse.ErrCouldNotParse) && err.Error() != "" {
			message = err.Error()
		}
		return c.JSON(http.StatusUnprocessableEntity, api.ParseErrorResponse{
			Error:   "could_not_parse",
			Message: message,
		})
	}

	return c.JSON(http.StatusOK, out)
}

func (h *ParseHandler) ParseMenu(c echo.Context) error {
	files, err := readFiles(c, "files[]")
	if err != nil {
		if errors.Is(err, errFileTooLarge) {
			return fileTooLargeResponse(c)
		}
		return c.JSON(http.StatusBadRequest, api.ParseErrorResponse{
			Error:   "missing_files",
			Message: `multipart field "files[]" must contain at least one file`,
		})
	}

	if h.service == nil {
		return c.JSON(http.StatusUnprocessableEntity, api.ParseErrorResponse{
			Error:   "could_not_parse",
			Message: "parse service is not configured",
		})
	}

	for _, file := range files {
		if !isPDFOrImage(file) {
			return c.JSON(http.StatusBadRequest, api.ParseErrorResponse{
				Error:   "unsupported_file_type",
				Message: "files must be PDFs or images",
			})
		}
	}

	out, err := h.service.ParseMenu(c.Request().Context(), files)
	if err != nil {
		if h.logger != nil {
			h.logger.Warn("menu parse failed", "error", err)
		}
		message := "could not parse document"
		if errors.Is(err, parse.ErrCouldNotParse) && err.Error() != "" {
			message = err.Error()
		}
		return c.JSON(http.StatusUnprocessableEntity, api.ParseErrorResponse{
			Error:   "could_not_parse",
			Message: message,
		})
	}

	return c.JSON(http.StatusOK, out)
}

func readSingleFile(c echo.Context, field string) (parse.UploadedFile, error) {
	header, err := c.FormFile(field)
	if err != nil {
		return parse.UploadedFile{}, err
	}

	return readFileHeader(header)
}

func readFiles(c echo.Context, field string) ([]parse.UploadedFile, error) {
	form, err := c.MultipartForm()
	if err != nil {
		return nil, err
	}

	headers := form.File[field]
	if len(headers) == 0 {
		return nil, echo.NewHTTPError(http.StatusBadRequest, "missing files")
	}

	files := make([]parse.UploadedFile, 0, len(headers))
	for _, header := range headers {
		file, err := readFileHeader(header)
		if err != nil {
			return nil, err
		}
		files = append(files, file)
	}
	return files, nil
}

func readFileHeader(header *multipart.FileHeader) (parse.UploadedFile, error) {
	src, err := header.Open()
	if err != nil {
		return parse.UploadedFile{}, err
	}
	defer src.Close()

	data, err := io.ReadAll(io.LimitReader(src, maxUploadFileSize+1))
	if err != nil {
		return parse.UploadedFile{}, err
	}
	if int64(len(data)) > maxUploadFileSize {
		return parse.UploadedFile{}, errFileTooLarge
	}

	contentType := strings.TrimSpace(header.Header.Get(echo.HeaderContentType))
	if contentType == "" {
		contentType = http.DetectContentType(data)
	}

	return parse.UploadedFile{
		Filename:    header.Filename,
		ContentType: contentType,
		Data:        data,
	}, nil
}

func isPDFOrImage(file parse.UploadedFile) bool {
	contentType := strings.ToLower(strings.TrimSpace(file.ContentType))
	if contentType == "application/pdf" || strings.HasPrefix(contentType, "image/") {
		return true
	}

	filename := strings.ToLower(file.Filename)
	return strings.HasSuffix(filename, ".pdf") &&
		(contentType == "" || contentType == "application/octet-stream")
}

func fileTooLargeResponse(c echo.Context) error {
	return c.JSON(http.StatusRequestEntityTooLarge, api.ParseErrorResponse{
		Error:   "file_too_large",
		Message: fmt.Sprintf("file must be %d bytes or smaller", maxUploadFileSize),
	})
}
