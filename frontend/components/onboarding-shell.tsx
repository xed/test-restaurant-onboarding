"use client";

import { ChevronRight, RotateCcw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";

import { OnboardingSteps } from "@/components/onboarding/onboarding-steps";
import { Button } from "@/components/ui/button";
import { getNextStep, onboardingSteps } from "@/lib/onboarding";
import { useOnboardingState } from "@/lib/onboarding-state";

export function OnboardingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const nextStep = getNextStep(pathname);
  const { resetOnboarding, setCurrentStep } = useOnboardingState();

  useEffect(() => {
    const step = onboardingSteps.find((item) => item.href === pathname);
    if (step) {
      setCurrentStep(step.id);
    }
  }, [pathname, setCurrentStep]);

  function handleReset() {
    resetOnboarding();
    router.push("/legal");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-3xl font-semibold tracking-normal">
                Restaurant onboarding
              </p>
              <h1 className="mt-1 text-base font-medium text-muted-foreground">
                Document review flow
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleReset}>
                <RotateCcw className="size-4" aria-hidden="true" />
                Reset Form
              </Button>
              {nextStep ? (
                <Button asChild>
                  <Link href={nextStep.href}>
                    Next
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" asChild>
                  <Link href="/legal">Start over</Link>
                </Button>
              )}
            </div>
          </div>

          <OnboardingSteps pathname={pathname} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
