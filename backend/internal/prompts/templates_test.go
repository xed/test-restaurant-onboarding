package prompts

import (
	"strings"
	"testing"
)

func TestLegalTemplateRequiredContract(t *testing.T) {
	assertContainsAll(t, LegalTemplate, []string{
		"Return only one valid JSON object",
		"Do not return markdown",
		"empty string",
		"French, English, or another language",
		"Do not translate extracted values",
		"legal_name",
		"siren",
		"siret",
		"legal_form",
		"legal_address",
		"legal_representative",
		"Return exactly these keys",
	})
}

func TestBankAccountTemplateRequiredContract(t *testing.T) {
	assertContainsAll(t, BankAccountTemplate, []string{
		"Return only one valid JSON object",
		"Do not return markdown",
		"empty string",
		"French, English, or another language",
		"Do not translate extracted values",
		"account_holder",
		"bank_name",
		"iban",
		"bic",
		"RIB",
		"Return exactly these keys",
	})
}

func TestMenuTemplateRequiredContract(t *testing.T) {
	assertContainsAll(t, MenuTemplate, []string{
		"Return only one valid JSON object",
		"Do not return markdown",
		"empty string",
		"empty items array",
		"French, English, or another language",
		"Do not translate extracted values",
		"menu",
		"items",
		"id",
		"price",
		"name",
		"description",
		"group_name",
		"order",
		`"12,50 €"`,
		"display string",
		"stable",
		"zero-based integer",
		"Group items",
		`"group_name": ""`,
		"one or multiple files",
	})
}

func assertContainsAll(t *testing.T, prompt string, required []string) {
	t.Helper()
	for _, want := range required {
		if !strings.Contains(prompt, want) {
			t.Fatalf("prompt does not contain %q\nprompt:\n%s", want, prompt)
		}
	}
}
