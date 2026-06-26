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
  createInitialOnboardingState,
  loadOnboardingState,
  saveOnboardingState
} from "@/lib/onboarding-storage";
import type { OnboardingState, OnboardingStepId } from "@/lib/onboarding-storage";

type OnboardingStateContextValue = {
  state: OnboardingState;
  setCurrentStep: (step: OnboardingStepId) => void;
  updateLegal: (legal: Partial<LegalParseResponse>) => void;
  replaceLegal: (legal: LegalParseResponse) => void;
  updateBanking: (banking: Partial<BankAccountParseResponse>) => void;
  replaceBanking: (banking: BankAccountParseResponse) => void;
  replaceMenu: (menu: MenuParseResponse) => void;
  setMenuGroups: (groups: string[]) => void;
  updateMenuItem: (id: string, item: Partial<MenuItem>) => void;
};

const OnboardingStateContext = createContext<OnboardingStateContextValue | null>(
  null
);

export function OnboardingStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(() =>
    createInitialOnboardingState()
  );
  const [isHydrated, setIsHydrated] = useState(false);

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
            order: item.order ?? index
          }))
        }
      }
    }));
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
                  ...item
                }
              : existing
          )
        }
      }
    }));
  }, []);

  const value = useMemo(
    () => ({
      state,
      setCurrentStep,
      updateLegal,
      replaceLegal,
      updateBanking,
      replaceBanking,
      replaceMenu,
      setMenuGroups,
      updateMenuItem
    }),
    [
      state,
      setCurrentStep,
      updateLegal,
      replaceLegal,
      updateBanking,
      replaceBanking,
      replaceMenu,
      setMenuGroups,
      updateMenuItem
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
