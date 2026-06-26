"use client";

import { ChangeEvent, useEffect } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import type { LegalParseResponse } from "@/lib/api/types";
import { useOnboardingState } from "@/lib/onboarding-state";
import { cn } from "@/lib/utils";

const primaryFields: Array<{
  name: keyof LegalParseResponse;
  label: string;
}> = [
  { name: "legal_name", label: "Legal name" },
  { name: "legal_form", label: "Legal form" }
];

const secondaryFields: Array<{
  name: keyof LegalParseResponse;
  label: string;
}> = [
  { name: "legal_address", label: "Registered address" },
  { name: "legal_representative", label: "Legal representative" }
];

const registrationNumberFields: Array<{
  name: keyof Pick<LegalParseResponse, "siren" | "siret">;
  label: string;
}> = [
  { name: "siren", label: "SIREN" },
  { name: "siret", label: "SIRET" }
];

export function LegalForm() {
  const { state, updateLegal } = useOnboardingState();
  const form = useForm<LegalParseResponse>({
    defaultValues: state.legal
  });

  useEffect(() => {
    form.reset(state.legal);
  }, [form, state.legal]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Legal entity</CardTitle>
        <CardDescription>
          Parsed or manually edited company registration fields are saved locally.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2">
          {primaryFields.map((field) => {
            const registration = form.register(field.name);

            return (
              <LegalInput
                key={field.name}
                label={field.label}
                registration={registration}
                isEmpty={state.legal[field.name].trim().length === 0}
                onChange={(value) =>
                  updateLegal({
                    [field.name]: value
                  } as Partial<LegalParseResponse>)
                }
              />
            );
          })}

          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
            {registrationNumberFields.map((field) => {
              const registration = form.register(field.name);
              const bothRegistrationNumbersEmpty =
                state.legal.siren.trim().length === 0 &&
                state.legal.siret.trim().length === 0;

              return (
                <LegalInput
                  key={field.name}
                  label={field.label}
                  registration={registration}
                  isEmpty={bothRegistrationNumbersEmpty}
                  onChange={(value) =>
                    updateLegal({
                      [field.name]: value
                    } as Partial<LegalParseResponse>)
                  }
                />
              );
            })}
          </div>

          {secondaryFields.map((field) => {
            const registration = form.register(field.name);

            return (
              <LegalInput
                key={field.name}
                label={field.label}
                registration={registration}
                isEmpty={state.legal[field.name].trim().length === 0}
                onChange={(value) =>
                  updateLegal({
                    [field.name]: value
                  } as Partial<LegalParseResponse>)
                }
              />
            );
          })}
        </form>
      </CardContent>
    </Card>
  );
}

function LegalInput({
  label,
  registration,
  isEmpty,
  onChange
}: {
  label: string;
  registration: UseFormRegisterReturn;
  isEmpty: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      <input
        {...registration}
        className={cn(
          "h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          isEmpty ? "border-amber-300 bg-amber-50/50 focus-visible:ring-amber-400" : null
        )}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          registration.onChange(event);
          onChange(event.target.value);
        }}
      />
    </label>
  );
}
