import type { OnboardingStepId } from "@/lib/onboarding-storage";

export type OnboardingStep = {
  href: string;
  id: OnboardingStepId;
  title: string;
  label: string;
};

export const onboardingSteps: OnboardingStep[] = [
  {
    href: "/legal",
    id: "legal",
    title: "Legal entity",
    label: "Legal"
  },
  {
    href: "/banking",
    id: "banking",
    title: "Banking details",
    label: "Banking"
  },
  {
    href: "/menu",
    id: "menu",
    title: "Menu builder",
    label: "Menu"
  },
  {
    href: "/restaurant",
    id: "restaurant",
    title: "Restaurant page",
    label: "Restaurant"
  }
];

export function getNextStep(href: string) {
  const currentIndex = onboardingSteps.findIndex((step) => step.href === href);

  if (currentIndex < 0) {
    return onboardingSteps[0];
  }

  return onboardingSteps[currentIndex + 1] ?? null;
}
