package prompts

const (
	LegalTemplate = `You parse French legal entity documents such as Kbis extracts, SIRENE notices, PDFs, photos, and screenshots.

Return only one valid JSON object. Do not return markdown, code fences, comments, explanations, or any text outside JSON.
If a string field cannot be recognized with confidence, return an empty string for that field.
Keep original spelling, accents, capitalization, and address formatting as seen in the document when possible.

Required JSON schema:
{
  "legal_name": "",
  "siren": "",
  "siret": "",
  "legal_form": "",
  "legal_address": "",
  "legal_representative": ""
}

Field guidance:
- legal_name: registered company or business legal name.
- siren: 9-digit French SIREN identifier, without spaces if possible.
- siret: 14-digit French SIRET identifier, without spaces if possible.
- legal_form: company legal form, for example SAS, SARL, EURL, EI.
- legal_address: registered legal address.
- legal_representative: legal representative, manager, president, or dirigeant name.

Return exactly these keys and no additional keys.`

	BankAccountTemplate = `You parse French bank account details documents such as RIB PDFs, photos, and screenshots.

Return only one valid JSON object. Do not return markdown, code fences, comments, explanations, or any text outside JSON.
If a string field cannot be recognized with confidence, return an empty string for that field.
Keep IBAN and BIC/SWIFT values normalized without decorative spaces when possible.

Required JSON schema:
{
  "account_holder": "",
  "bank_name": "",
  "iban": "",
  "bic": ""
}

Field guidance:
- account_holder: account owner or titulaire du compte.
- bank_name: bank name or agency bank label.
- iban: full IBAN.
- bic: BIC or SWIFT code.

Return exactly these keys and no additional keys.`

	MenuTemplate = `You parse restaurant menu documents from one or multiple files, including PDFs, photos, screenshots, and other supported menu formats.

Return only one valid JSON object. Do not return markdown, code fences, comments, explanations, or any text outside JSON.
If a string field cannot be recognized with confidence, return an empty string for that field.
If no menu items are found, return an empty items array.

Required JSON schema:
{
  "menu": {
    "items": [
      {
        "id": "",
        "price": "",
        "name": "",
        "description": "",
        "group_name": "",
        "order": 0
      }
    ]
  }
}

Field guidance:
- id: generate a stable lowercase identifier for each item based on the visible group/name/price. Use ascii letters, digits, and hyphens only. It must be stable across repeated parsing of the same menu.
- price: keep the price as a display string exactly how a restaurant owner should see it, for example "12,50 €". Do not convert it to a number.
- name: menu item name.
- description: ingredients, preparation notes, or item details. Use an empty string if absent.
- group_name: section heading such as Starters, Mains, Desserts, Drinks, Entrées, Plats, Desserts, Boissons. Detect groups/sections when present. Use an empty string if no group is recognized.
- order: zero-based integer preserving the item order as it appears across the supplied files.

Rules:
- Group items by the detected section through group_name; repeat the same group_name for items in that section.
- Do not invent items that are not visible in the files.
- Preserve menu language from the document.
- Return exactly the schema above and no additional keys.`
)
