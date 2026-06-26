"use client";

import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { getNextStep, onboardingSteps } from "@/lib/onboarding";
import { useOnboardingState } from "@/lib/onboarding-state";
import { cn } from "@/lib/utils";

export function OnboardingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const nextStep = getNextStep(pathname);
  const { setCurrentStep } = useOnboardingState();

  useEffect(() => {
    const step = onboardingSteps.find((item) => item.href === pathname);
    if (step) {
      setCurrentStep(step.id);
    }
  }, [pathname, setCurrentStep]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Restaurant onboarding
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal">
                Document review flow
              </h1>
            </div>
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

          <nav aria-label="Onboarding steps" className="overflow-x-auto">
            <ol className="flex min-w-max items-center gap-2">
              {onboardingSteps.map((step, index) => {
                const isActive = pathname === step.href;
                const currentIndex = onboardingSteps.findIndex(
                  (item) => item.href === pathname
                );
                const isComplete = currentIndex > index;

                return (
                  <li key={step.href} className="flex items-center gap-2">
                    <Link
                      href={step.href}
                      className={cn(
                        "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
                        isActive
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:bg-accent"
                      )}
                      aria-current={isActive ? "step" : undefined}
                    >
                      <span
                        className={cn(
                          "flex size-5 items-center justify-center rounded-full text-xs",
                          isActive
                            ? "bg-primary-foreground text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {isComplete ? (
                          <Check className="size-3" aria-hidden="true" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      {step.label}
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
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
