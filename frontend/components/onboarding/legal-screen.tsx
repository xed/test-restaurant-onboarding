"use client";

import { AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { LegalForm } from "@/components/onboarding/legal-form";
import { UploadPreparation } from "@/components/onboarding/upload-preparation";
import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/components/upload-dropzone";
import { formatParseError } from "@/lib/api/error-messages";
import { useParseLegalMutation } from "@/lib/api/mutations";
import { useOnboardingState } from "@/lib/onboarding-state";
import { saveOnboardingState } from "@/lib/onboarding-storage";

export function LegalScreen() {
  const router = useRouter();
  const { state, replaceLegal, setCurrentStep } = useOnboardingState();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const parseLegalMutation = useParseLegalMutation();

  function handleFilesChange(files: File[]) {
    setSelectedFiles(files);
    parseLegalMutation.reset();

    const [file] = files;
    if (!file) {
      return;
    }

    parseLegalMutation.mutate(file, {
      onSuccess: (response) => {
        replaceLegal(response);
      }
    });
  }

  function handleNext() {
    const nextState = {
      ...state,
      current_step: "banking" as const
    };

    setCurrentStep("banking");
    saveOnboardingState(nextState);
    router.push("/banking");
  }

  return (
    <div className="grid gap-6">
      <UploadPreparation title="Prepare the legal entity document">
        Prepare a KBIS extract, SIRENE extract, registration certificate, or another
        official document that identifies the restaurant entity. After upload, we
        will extract the legal name, registration number, address, and VAT details
        when available. You can review and correct the extracted fields before
        continuing.
      </UploadPreparation>

      <UploadDropzone
        title="Upload legal entity document"
        description="Kbis, SIRENE extract, PDF, photo, or screenshot. The document is parsed as soon as it is selected."
        mode="single"
        accept="application/pdf,image/*"
        files={selectedFiles}
        loading={parseLegalMutation.isPending}
        error={
          parseLegalMutation.error
            ? formatParseError(parseLegalMutation.error, "legal")
            : null
        }
        onFilesChange={handleFilesChange}
      />

      {parseLegalMutation.isSuccess ? (
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Document parsed. Review and edit the legal fields below.</span>
        </div>
      ) : null}

      {parseLegalMutation.isError ? (
        <div
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Upload another document or fill the legal fields manually to continue.
          </span>
        </div>
      ) : null}

      <LegalForm />

      <div className="flex justify-end">
        <Button type="button" onClick={handleNext}>
          Next
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
