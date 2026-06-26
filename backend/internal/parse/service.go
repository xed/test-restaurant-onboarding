package parse

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"github.com/xed/test-restaurant-onboarding/backend/internal/api"
	"github.com/xed/test-restaurant-onboarding/backend/internal/llm"
	"github.com/xed/test-restaurant-onboarding/backend/internal/prompts"
)

var ErrCouldNotParse = errors.New("could_not_parse")

type ParseError struct {
	Message string
	Err     error
}

func (e *ParseError) Error() string {
	if e == nil {
		return ""
	}
	if e.Message != "" {
		return e.Message
	}
	return ErrCouldNotParse.Error()
}

func (e *ParseError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

type UploadedFile struct {
	Filename    string
	ContentType string
	Data        []byte
}

type Service interface {
	ParseLegal(ctx context.Context, file UploadedFile) (api.LegalParseResponse, error)
	ParseBankAccount(ctx context.Context, file UploadedFile) (api.BankAccountParseResponse, error)
	ParseMenu(ctx context.Context, files []UploadedFile) (api.MenuParseResponse, error)
}

type service struct {
	provider llm.Provider
}

func NewService(provider llm.Provider) Service {
	return &service{provider: provider}
}

func (s *service) ParseLegal(ctx context.Context, file UploadedFile) (api.LegalParseResponse, error) {
	var out api.LegalParseResponse
	if err := s.generateAndDecode(ctx, prompts.LegalTemplate, []UploadedFile{file}, &out); err != nil {
		return api.LegalParseResponse{}, err
	}
	return out, nil
}

func (s *service) ParseBankAccount(ctx context.Context, file UploadedFile) (api.BankAccountParseResponse, error) {
	var out api.BankAccountParseResponse
	if err := s.generateAndDecode(ctx, prompts.BankAccountTemplate, []UploadedFile{file}, &out); err != nil {
		return api.BankAccountParseResponse{}, err
	}
	return out, nil
}

func (s *service) ParseMenu(ctx context.Context, files []UploadedFile) (api.MenuParseResponse, error) {
	var out api.MenuParseResponse
	if err := s.generateAndDecode(ctx, prompts.MenuTemplate, files, &out); err != nil {
		return api.MenuParseResponse{}, err
	}
	if out.Menu.Items == nil {
		out.Menu.Items = []api.MenuItem{}
	}
	return out, nil
}

func (s *service) generateAndDecode(ctx context.Context, prompt string, files []UploadedFile, out any) error {
	if s.provider == nil {
		return &ParseError{
			Message: "LLM provider is not configured",
			Err:     ErrCouldNotParse,
		}
	}

	raw, err := s.provider.GenerateStructuredJSON(ctx, llm.StructuredRequest{
		Prompt: prompt,
		Files:  toLLMFiles(files),
	})
	if err != nil {
		return &ParseError{
			Message: "could not parse document",
			Err:     fmt.Errorf("%w: %v", ErrCouldNotParse, err),
		}
	}

	if err := decodeStrictJSON(raw, out); err != nil {
		return &ParseError{
			Message: "LLM returned invalid JSON",
			Err:     fmt.Errorf("%w: %v", ErrCouldNotParse, err),
		}
	}

	return nil
}

func decodeStrictJSON(raw []byte, out any) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(out); err != nil {
		return err
	}
	if decoder.More() {
		return errors.New("unexpected trailing JSON token")
	}

	var trailing any
	if err := decoder.Decode(&trailing); err == nil {
		return errors.New("unexpected trailing JSON value")
	} else if !errors.Is(err, io.EOF) {
		return err
	}
	return nil
}

func toLLMFiles(files []UploadedFile) []llm.File {
	out := make([]llm.File, 0, len(files))
	for _, file := range files {
		out = append(out, llm.File{
			Filename:    file.Filename,
			ContentType: file.ContentType,
			Data:        file.Data,
		})
	}
	return out
}
