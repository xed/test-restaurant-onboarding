"use client";

import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";

import type { MenuItem } from "@/lib/api/types";
import { onboardingSteps } from "@/lib/onboarding";
import { useOnboardingState } from "@/lib/onboarding-state";
import type { OnboardingState, OnboardingStepId } from "@/lib/onboarding-storage";
import { cn } from "@/lib/utils";

type StepFillStatus = "empty" | "partial" | "complete";

type OnboardingStepsProps = {
  pathname: string;
};

export function OnboardingSteps({ pathname }: OnboardingStepsProps) {
  const { state } = useOnboardingState();
  const statuses = getStepStatuses(state);

  return (
    <nav aria-label="Onboarding steps" className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-2">
        {onboardingSteps.map((step, index) => {
          const isActive = pathname === step.href;
          const status = statuses[step.id];

          return (
            <li key={step.href} className="flex items-center gap-2">
              <Link
                href={step.href}
                className={cn(
                  "relative inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
                  getStepClassName(status),
                  isActive
                    ? "border-primary shadow-sm ring-1 ring-primary/30 after:absolute after:inset-x-2 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-primary"
                    : null
                )}
                aria-current={isActive ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-xs",
                    getStepMarkerClassName(status)
                  )}
                >
                  {status === "complete" ? (
                    <Check className="size-3" aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </span>
                {step.label}
                {isActive ? (
                  <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-normal text-primary-foreground">
                    Current
                  </span>
                ) : null}
              </Link>
              {index < onboardingSteps.length - 1 ? (
                <ChevronRight
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function getStepStatuses(state: OnboardingState): Record<OnboardingStepId, StepFillStatus> {
  const legal = getLegalStatus(state.legal);
  const banking = getFieldsStatus(Object.values(state.banking));
  const menu = getMenuStatus(state.menu.menu.items);
  const restaurant = combineStatuses([legal, banking, menu]);

  return {
    legal,
    banking,
    menu,
    restaurant
  };
}

function getMenuStatus(items: MenuItem[]): StepFillStatus {
  if (items.length === 0) {
    return "empty";
  }

  return combineStatuses(
    items.map((item) => getFieldsStatus([item.name, item.price]))
  );
}

function getLegalStatus(state: OnboardingState["legal"]): StepFillStatus {
  const requiredFields = [
    state.legal_name,
    state.legal_form,
    state.legal_address,
    state.legal_representative
  ];
  const hasRegistrationNumber =
    state.siren.trim().length > 0 || state.siret.trim().length > 0;
  const filledRequiredCount = requiredFields.filter(
    (value) => value.trim().length > 0
  ).length;

  if (filledRequiredCount === 0 && !hasRegistrationNumber) {
    return "empty";
  }

  if (filledRequiredCount === requiredFields.length && hasRegistrationNumber) {
    return "complete";
  }

  return "partial";
}

function getFieldsStatus(values: string[]): StepFillStatus {
  const filledCount = values.filter((value) => value.trim().length > 0).length;

  if (filledCount === 0) {
    return "empty";
  }

  return filledCount === values.length ? "complete" : "partial";
}

function combineStatuses(statuses: StepFillStatus[]): StepFillStatus {
  if (statuses.every((status) => status === "complete")) {
    return "complete";
  }

  if (statuses.some((status) => status !== "empty")) {
    return "partial";
  }

  return "empty";
}

function getStepClassName(status: StepFillStatus) {
  if (status === "complete") {
    return "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100";
  }

  if (status === "partial") {
    return "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100";
  }

  return "border-red-200 bg-red-50/40 text-foreground hover:bg-red-50/70";
}

function getStepMarkerClassName(status: StepFillStatus) {
  if (status === "complete") {
    return "bg-emerald-600 text-white";
  }

  if (status === "partial") {
    return "bg-amber-500 text-white";
  }

  return "bg-red-100 text-red-700";
}
