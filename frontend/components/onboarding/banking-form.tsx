"use client";

import { ChangeEvent, useEffect } from "react";
import { useForm } from "react-hook-form";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import type { BankAccountParseResponse } from "@/lib/api/types";
import { useOnboardingState } from "@/lib/onboarding-state";
import { cn } from "@/lib/utils";

const fields: Array<{
  name: keyof BankAccountParseResponse;
  label: string;
}> = [
  { name: "account_holder", label: "Account holder" },
  { name: "bank_name", label: "Bank name" },
  { name: "iban", label: "IBAN" },
  { name: "bic", label: "BIC / SWIFT" }
];

export function BankingForm() {
  const { state, updateBanking } = useOnboardingState();
  const form = useForm<BankAccountParseResponse>({
    defaultValues: state.banking
  });

  useEffect(() => {
    form.reset(state.banking);
  }, [form, state.banking]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Banking details</CardTitle>
        <CardDescription>
          Parsed or manually edited banking fields are saved locally.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => {
            const registration = form.register(field.name);
            const isEmpty = state.banking[field.name].trim().length === 0;

            return (
              <label key={field.name} className="grid gap-2">
                <span className="text-sm font-medium">{field.label}</span>
                <input
                  {...registration}
                  className={cn(
                    "h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    isEmpty
                      ? "border-amber-300 bg-amber-50/50 focus-visible:ring-amber-400"
                      : null
                  )}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    registration.onChange(event);
                    updateBanking({
                      [field.name]: event.target.value
                    } as Partial<BankAccountParseResponse>);
                  }}
                />
              </label>
            );
          })}
        </form>
      </CardContent>
    </Card>
  );
}
