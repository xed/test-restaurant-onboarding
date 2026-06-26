import type {
  BankAccountParseResponse,
  LegalParseResponse,
  MenuParseResponse
} from "@/lib/api/types";

export const ONBOARDING_STORAGE_KEY = "restaurant_onboarding:v1";

export type OnboardingStepId = "legal" | "banking" | "menu" | "restaurant";

export type OnboardingState = {
  current_step: OnboardingStepId;
  legal: LegalParseResponse;
  banking: BankAccountParseResponse;
  menu: MenuParseResponse;
  menu_groups: string[];
};

export const emptyLegal: LegalParseResponse = {
  legal_name: "",
  siren: "",
  siret: "",
  legal_form: "",
  legal_address: "",
  legal_representative: ""
};

export const emptyBanking: BankAccountParseResponse = {
  account_holder: "",
  bank_name: "",
  iban: "",
  bic: ""
};

export const emptyMenu: MenuParseResponse = {
  menu: {
    items: []
  }
};

export function createInitialOnboardingState(): OnboardingState {
  return {
    current_step: "legal",
    legal: { ...emptyLegal },
    banking: { ...emptyBanking },
    menu: {
      menu: {
        items: []
      }
    },
    menu_groups: []
  };
}

export function loadOnboardingState(storage = getBrowserStorage()) {
  if (!storage) {
    return createInitialOnboardingState();
  }

  const raw = storage.getItem(ONBOARDING_STORAGE_KEY);
  if (!raw) {
    return createInitialOnboardingState();
  }

  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return createInitialOnboardingState();
  }
}

export function saveOnboardingState(
  state: OnboardingState,
  storage = getBrowserStorage()
) {
  if (!storage) {
    return;
  }

  storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(normalizeState(state)));
}

function getBrowserStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function normalizeState(value: unknown): OnboardingState {
  if (!isRecord(value)) {
    return createInitialOnboardingState();
  }

  const menuItems = getNested(value.menu, "menu", "items");

  return {
    current_step: normalizeStep(value.current_step),
    legal: {
      legal_name: normalizeString(value.legal, "legal_name"),
      siren: normalizeString(value.legal, "siren"),
      siret: normalizeString(value.legal, "siret"),
      legal_form: normalizeString(value.legal, "legal_form"),
      legal_address: normalizeString(value.legal, "legal_address"),
      legal_representative: normalizeString(value.legal, "legal_representative")
    },
    banking: {
      account_holder: normalizeString(value.banking, "account_holder"),
      bank_name: normalizeString(value.banking, "bank_name"),
      iban: normalizeString(value.banking, "iban"),
      bic: normalizeString(value.banking, "bic")
    },
    menu: {
      menu: {
        items: Array.isArray(menuItems)
          ? menuItems.filter(isRecord).map((item, index) => ({
              id: normalizeString(item, "id"),
              price: normalizeString(item, "price"),
              name: normalizeString(item, "name"),
              description: normalizeString(item, "description"),
              group_name: normalizeString(item, "group_name"),
              order:
                typeof item.order === "number" && Number.isFinite(item.order)
                  ? item.order
                  : index
            }))
          : []
      }
    },
    menu_groups: Array.isArray(value.menu_groups)
      ? value.menu_groups
          .filter((group): group is string => typeof group === "string")
          .map((group) => group.trim())
          .filter(Boolean)
      : []
  };
}

function normalizeStep(value: unknown): OnboardingStepId {
  if (
    value === "legal" ||
    value === "banking" ||
    value === "menu" ||
    value === "restaurant"
  ) {
    return value;
  }

  return "legal";
}

function normalizeString(source: unknown, key: string) {
  if (!isRecord(source)) {
    return "";
  }

  const value = source[key];
  return typeof value === "string" ? value : "";
}

function getNested(source: unknown, firstKey: string, secondKey: string) {
  if (!isRecord(source)) {
    return undefined;
  }

  const nested = source[firstKey];
  if (!isRecord(nested)) {
    return undefined;
  }

  return nested[secondKey];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
