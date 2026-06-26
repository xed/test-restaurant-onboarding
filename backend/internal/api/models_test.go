package api

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestResponseJSONFields(t *testing.T) {
	bank, err := json.Marshal(BankAccountParseResponse{})
	if err != nil {
		t.Fatalf("marshal bank account response: %v", err)
	}
	if !strings.Contains(string(bank), "account_holder") {
		t.Fatalf("expected account_holder field, got %s", bank)
	}
	if strings.Contains(string(bank), "account_number") {
		t.Fatalf("did not expect account_number field, got %s", bank)
	}

	menu, err := json.Marshal(MenuParseResponse{
		Menu: Menu{Items: []MenuItem{{}}},
	})
	if err != nil {
		t.Fatalf("marshal menu response: %v", err)
	}
	for _, field := range []string{"id", "price", "name", "description", "group_name", "order"} {
		if !strings.Contains(string(menu), `"`+field+`"`) {
			t.Fatalf("expected menu field %q, got %s", field, menu)
		}
	}
}
