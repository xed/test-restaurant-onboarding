export type LegalParseResponse = {
  legal_name: string;
  siren: string;
  siret: string;
  legal_form: string;
  legal_address: string;
  legal_representative: string;
};

export type BankAccountParseResponse = {
  account_holder: string;
  bank_name: string;
  iban: string;
  bic: string;
};

export type MenuItem = {
  id: string;
  price: string;
  name: string;
  description: string;
  group_name: string;
  order: number;
};

export type MenuParseResponse = {
  menu: {
    items: MenuItem[];
  };
};

export type ParseErrorResponse = {
  error: string;
  message: string;
};
