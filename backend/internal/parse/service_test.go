package parse

import (
	"context"
	"errors"
	"testing"

	"github.com/xed/test-restaurant-onboarding/backend/internal/llm"
	"github.com/xed/test-restaurant-onboarding/backend/internal/prompts"
)

type fakeProvider struct {
	requests []llm.StructuredRequest
	resp     []byte
	err      error
}

func (p *fakeProvider) GenerateStructuredJSON(_ context.Context, req llm.StructuredRequest) ([]byte, error) {
	p.requests = append(p.requests, req)
	return p.resp, p.err
}

func TestParseLegalSuccessKeepsEmptyFields(t *testing.T) {
	provider := &fakeProvider{resp: []byte(`{
		"legal_name": "SAVEURS DU SOLEIL LEVANT",
		"siren": "123456789",
		"siret": "",
		"legal_form": "SAS",
		"legal_address": "",
		"legal_representative": "Jane Doe"
	}`)}
	service := NewService(provider)

	got, err := service.ParseLegal(context.Background(), UploadedFile{
		Filename:    "kbis.pdf",
		ContentType: "application/pdf",
		Data:        []byte("pdf"),
	})
	if err != nil {
		t.Fatalf("ParseLegal returned error: %v", err)
	}
	if got.LegalName != "SAVEURS DU SOLEIL LEVANT" {
		t.Fatalf("unexpected legal name: %q", got.LegalName)
	}
	if got.SIRET != "" || got.LegalAddress != "" {
		t.Fatalf("expected empty fields to be preserved, got siret=%q address=%q", got.SIRET, got.LegalAddress)
	}
	assertSingleRequest(t, provider, prompts.LegalTemplate, 1)
}

func TestParseBankAccountSuccess(t *testing.T) {
	provider := &fakeProvider{resp: []byte(`{
		"account_holder": "SAVEURS DU SOLEIL LEVANT",
		"bank_name": "BNP PARIBAS",
		"iban": "FR7612345678901234567890185",
		"bic": "BNPAFRPP"
	}`)}
	service := NewService(provider)

	got, err := service.ParseBankAccount(context.Background(), UploadedFile{
		Filename:    "rib.pdf",
		ContentType: "application/pdf",
		Data:        []byte("rib"),
	})
	if err != nil {
		t.Fatalf("ParseBankAccount returned error: %v", err)
	}
	if got.AccountHolder != "SAVEURS DU SOLEIL LEVANT" {
		t.Fatalf("unexpected account holder: %q", got.AccountHolder)
	}
	if got.IBAN != "FR7612345678901234567890185" {
		t.Fatalf("unexpected iban: %q", got.IBAN)
	}
	assertSingleRequest(t, provider, prompts.BankAccountTemplate, 1)
}

func TestParseMenuSuccessAndEmptyItems(t *testing.T) {
	provider := &fakeProvider{resp: []byte(`{"menu":{"items":null}}`)}
	service := NewService(provider)

	got, err := service.ParseMenu(context.Background(), []UploadedFile{
		{Filename: "menu-1.png", ContentType: "image/png", Data: []byte("png")},
		{Filename: "menu-2.pdf", ContentType: "application/pdf", Data: []byte("pdf")},
	})
	if err != nil {
		t.Fatalf("ParseMenu returned error: %v", err)
	}
	if got.Menu.Items == nil {
		t.Fatal("expected nil menu items to be normalized to an empty slice")
	}
	if len(got.Menu.Items) != 0 {
		t.Fatalf("expected empty menu items, got %d", len(got.Menu.Items))
	}
	assertSingleRequest(t, provider, prompts.MenuTemplate, 2)
}

func TestParseMenuItemsSuccess(t *testing.T) {
	provider := &fakeProvider{resp: []byte(`{
		"menu": {
			"items": [
				{
					"id": "mains-ramen-1250",
					"price": "12,50 €",
					"name": "Ramen",
					"description": "",
					"group_name": "Mains",
					"order": 0
				}
			]
		}
	}`)}
	service := NewService(provider)

	got, err := service.ParseMenu(context.Background(), []UploadedFile{{Filename: "menu.png"}})
	if err != nil {
		t.Fatalf("ParseMenu returned error: %v", err)
	}
	if len(got.Menu.Items) != 1 {
		t.Fatalf("expected one menu item, got %d", len(got.Menu.Items))
	}
	item := got.Menu.Items[0]
	if item.Price != "12,50 €" || item.Description != "" {
		t.Fatalf("unexpected item: %+v", item)
	}
}

func TestInvalidJSONReturnsControlledParseError(t *testing.T) {
	provider := &fakeProvider{resp: []byte(`{"legal_name":`)}
	service := NewService(provider)

	_, err := service.ParseLegal(context.Background(), UploadedFile{})
	if err == nil {
		t.Fatal("expected error")
	}
	if !errors.Is(err, ErrCouldNotParse) {
		t.Fatalf("expected ErrCouldNotParse, got %v", err)
	}
}

func TestUnknownJSONFieldReturnsControlledParseError(t *testing.T) {
	provider := &fakeProvider{resp: []byte(`{
		"account_holder": "",
		"bank_name": "",
		"iban": "",
		"bic": "",
		"account_number": "should not be accepted"
	}`)}
	service := NewService(provider)

	_, err := service.ParseBankAccount(context.Background(), UploadedFile{})
	if err == nil {
		t.Fatal("expected error")
	}
	if !errors.Is(err, ErrCouldNotParse) {
		t.Fatalf("expected ErrCouldNotParse, got %v", err)
	}
}

func TestProviderErrorReturnsControlledParseError(t *testing.T) {
	provider := &fakeProvider{err: errors.New("provider unavailable")}
	service := NewService(provider)

	_, err := service.ParseMenu(context.Background(), []UploadedFile{{Filename: "menu.png"}})
	if err == nil {
		t.Fatal("expected error")
	}
	if !errors.Is(err, ErrCouldNotParse) {
		t.Fatalf("expected ErrCouldNotParse, got %v", err)
	}
}

func TestProviderTimeoutReturnsControlledParseError(t *testing.T) {
	provider := &fakeProvider{err: context.DeadlineExceeded}
	service := NewService(provider)

	_, err := service.ParseLegal(context.Background(), UploadedFile{Filename: "kbis.pdf"})
	if err == nil {
		t.Fatal("expected error")
	}
	if !errors.Is(err, ErrCouldNotParse) {
		t.Fatalf("expected ErrCouldNotParse, got %v", err)
	}
}

func assertSingleRequest(t *testing.T, provider *fakeProvider, prompt string, fileCount int) {
	t.Helper()
	if len(provider.requests) != 1 {
		t.Fatalf("expected one provider request, got %d", len(provider.requests))
	}
	if provider.requests[0].Prompt != prompt {
		t.Fatalf("unexpected prompt")
	}
	if len(provider.requests[0].Files) != fileCount {
		t.Fatalf("expected %d files, got %d", fileCount, len(provider.requests[0].Files))
	}
}
