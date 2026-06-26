"use client";

import { useForm } from "react-hook-form";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

type BasicFormPreviewProps = {
  title: string;
  description: string;
  fields: string[];
};

export function BasicFormPreview({ title, description, fields }: BasicFormPreviewProps) {
  useForm({
    defaultValues: Object.fromEntries(fields.map((field) => [field, ""]))
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field} className="rounded-md border border-border bg-muted/40 p-3">
              <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                {field}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">Awaiting parsed data</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
