package api

type LegalParseResponse struct {
	LegalName           string `json:"legal_name"`
	SIREN               string `json:"siren"`
	SIRET               string `json:"siret"`
	LegalForm           string `json:"legal_form"`
	LegalAddress        string `json:"legal_address"`
	LegalRepresentative string `json:"legal_representative"`
}

type BankAccountParseResponse struct {
	AccountHolder string `json:"account_holder"`
	BankName      string `json:"bank_name"`
	IBAN          string `json:"iban"`
	BIC           string `json:"bic"`
}

type MenuParseResponse struct {
	Menu Menu `json:"menu"`
}

type Menu struct {
	Items []MenuItem `json:"items"`
}

type MenuItem struct {
	ID          string `json:"id"`
	Price       string `json:"price"`
	Name        string `json:"name"`
	Description string `json:"description"`
	GroupName   string `json:"group_name"`
	Order       int    `json:"order"`
}

type ParseErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}
