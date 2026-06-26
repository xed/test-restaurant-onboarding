"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import type {
  BankAccountParseResponse,
  LegalParseResponse,
  MenuItem,
  MenuParseResponse
} from "@/lib/api/types";
import {
  clearOnboardingState,
  createInitialOnboardingState,
  loadOnboardingState,
  saveOnboardingState
} from "@/lib/onboarding-storage";
import type { OnboardingState, OnboardingStepId } from "@/lib/onboarding-storage";

type OnboardingStateContextValue = {
  state: OnboardingState;
  isNavigationLocked: boolean;
  setCurrentStep: (step: OnboardingStepId) => void;
  setNavigationLocked: (isLocked: boolean) => void;
  updateLegal: (legal: Partial<LegalParseResponse>) => void;
  replaceLegal: (legal: LegalParseResponse) => void;
  updateBanking: (banking: Partial<BankAccountParseResponse>) => void;
  replaceBanking: (banking: BankAccountParseResponse) => void;
  replaceMenu: (menu: MenuParseResponse) => void;
  appendMenu: (menu: MenuParseResponse) => void;
  setMenuGroups: (groups: string[]) => void;
  updateMenuItem: (id: string, item: Partial<MenuItem>) => void;
  resetOnboarding: () => void;
};

const OnboardingStateContext = createContext<OnboardingStateContextValue | null>(
  null
);

export function OnboardingStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(() =>
    createInitialOnboardingState()
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [isNavigationLocked, setNavigationLocked] = useState(false);

  useEffect(() => {
    setState(loadOnboardingState());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      saveOnboardingState(state);
    }
  }, [isHydrated, state]);

  const setCurrentStep = useCallback((step: OnboardingStepId) => {
    setState((current) => ({
      ...current,
      current_step: step
    }));
  }, []);

  const updateLegal = useCallback((legal: Partial<LegalParseResponse>) => {
    setState((current) => ({
      ...current,
      legal: {
        ...current.legal,
        ...legal
      }
    }));
  }, []);

  const replaceLegal = useCallback((legal: LegalParseResponse) => {
    setState((current) => ({
      ...current,
      legal: { ...legal }
    }));
  }, []);

  const updateBanking = useCallback((banking: Partial<BankAccountParseResponse>) => {
    setState((current) => ({
      ...current,
      banking: {
        ...current.banking,
        ...banking
      }
    }));
  }, []);

  const replaceBanking = useCallback((banking: BankAccountParseResponse) => {
    setState((current) => ({
      ...current,
      banking: { ...banking }
    }));
  }, []);

  const replaceMenu = useCallback((menu: MenuParseResponse) => {
    setState((current) => ({
      ...current,
      menu: {
        menu: {
          items: menu.menu.items.map((item, index) => ({
            ...item,
            price: normalizePrice(item.price),
            order: item.order ?? index
          }))
        }
      }
    }));
  }, []);

  const appendMenu = useCallback((menu: MenuParseResponse) => {
    setState((current) => {
      const existingItems = current.menu.menu.items;
      const usedIds = new Set(existingItems.map((item) => item.id).filter(Boolean));
      const parsedItems = menu.menu.items.map((item, index) => ({
        ...item,
        id: createUniqueMenuItemId(item.id, usedIds, existingItems.length + index),
        price: normalizePrice(item.price),
        order: existingItems.length + index
      }));

      return {
        ...current,
        menu: {
          menu: {
            items: [...existingItems, ...parsedItems]
          }
        },
        menu_groups: mergeMenuGroups(
          current.menu_groups,
          getParsedGroupNames(parsedItems)
        )
      };
    });
  }, []);

  const setMenuGroups = useCallback((groups: string[]) => {
    setState((current) => ({
      ...current,
      menu_groups: groups
    }));
  }, []);

  const updateMenuItem = useCallback((id: string, item: Partial<MenuItem>) => {
    setState((current) => ({
      ...current,
      menu: {
        menu: {
          items: current.menu.menu.items.map((existing) =>
            existing.id === id
              ? {
                  ...existing,
                  ...item,
                  price:
                    typeof item.price === "string"
                      ? normalizePrice(item.price)
                      : existing.price
                }
              : existing
          )
        }
      }
    }));
  }, []);

  const resetOnboarding = useCallback(() => {
    const initialState = createInitialOnboardingState();
    clearOnboardingState();
    setState(initialState);
    saveOnboardingState(initialState);
  }, []);

  const value = useMemo(
    () => ({
      state,
      isNavigationLocked,
      setCurrentStep,
      setNavigationLocked,
      updateLegal,
      replaceLegal,
      updateBanking,
      replaceBanking,
      replaceMenu,
      appendMenu,
      setMenuGroups,
      updateMenuItem,
      resetOnboarding
    }),
    [
      state,
      isNavigationLocked,
      setCurrentStep,
      setNavigationLocked,
      updateLegal,
      replaceLegal,
      updateBanking,
      replaceBanking,
      replaceMenu,
      appendMenu,
      setMenuGroups,
      updateMenuItem,
      resetOnboarding
    ]
  );

  return (
    <OnboardingStateContext.Provider value={value}>
      {children}
    </OnboardingStateContext.Provider>
  );
}

export function useOnboardingState() {
  const value = useContext(OnboardingStateContext);

  if (!value) {
    throw new Error("useOnboardingState must be used within OnboardingStateProvider");
  }

  return value;
}

function normalizePrice(value: string) {
  return value.replace(/[€£$]/g, "").replace(/\bEUR\b/gi, "").trim();
}

function createUniqueMenuItemId(
  requestedId: string,
  usedIds: Set<string>,
  fallbackIndex: number
) {
  const baseId = (requestedId.trim() || `parsed-item-${fallbackIndex + 1}`).replace(
    /\s+/g,
    "-"
  );
  let candidate = baseId;
  let suffix = 2;

  while (usedIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(candidate);
  return candidate;
}

function getParsedGroupNames(items: MenuItem[]) {
  return Array.from(
    new Set(
      items
        .map((item) => item.group_name.trim())
        .filter((groupName) => groupName.length > 0)
    )
  );
}

function mergeMenuGroups(existingGroups: string[], parsedGroups: string[]) {
  const nextGroups = [...existingGroups];
  const existingNames = new Set(existingGroups.map((group) => group.trim()));

  for (const group of parsedGroups) {
    if (!existingNames.has(group)) {
      nextGroups.push(group);
      existingNames.add(group);
    }
  }

  return nextGroups;
}
