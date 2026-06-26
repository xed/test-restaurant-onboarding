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
import type { LegalParseResponse } from "@/lib/api/types";
import { useOnboardingState } from "@/lib/onboarding-state";

const fields: Array<{
  name: keyof LegalParseResponse;
  label: string;
}> = [
  { name: "legal_name", label: "Legal name" },
  { name: "siren", label: "SIREN" },
  { name: "siret", label: "SIRET" },
  { name: "legal_form", label: "Legal form" },
  { name: "legal_address", label: "Registered address" },
  { name: "legal_representative", label: "Legal representative" }
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
          {fields.map((field) => {
            const registration = form.register(field.name);

            return (
              <label key={field.name} className="grid gap-2">
                <span className="text-sm font-medium">{field.label}</span>
                <input
                  {...registration}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    registration.onChange(event);
                    updateLegal({
                      [field.name]: event.target.value
                    } as Partial<LegalParseResponse>);
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
