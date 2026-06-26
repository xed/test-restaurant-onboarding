"use client";

import { AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BankingForm } from "@/components/onboarding/banking-form";
import { UploadPreparation } from "@/components/onboarding/upload-preparation";
import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/components/upload-dropzone";
import { formatParseError } from "@/lib/api/error-messages";
import { useParseBankAccountMutation } from "@/lib/api/mutations";
import { useOnboardingState } from "@/lib/onboarding-state";
import { saveOnboardingState } from "@/lib/onboarding-storage";

export function BankingScreen() {
  const router = useRouter();
  const { state, replaceBanking, setCurrentStep } = useOnboardingState();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const parseBankAccountMutation = useParseBankAccountMutation();

  function handleFilesChange(files: File[]) {
    setSelectedFiles(files);
    parseBankAccountMutation.reset();

    const [file] = files;
    if (!file) {
      return;
    }

    parseBankAccountMutation.mutate(file, {
      onSuccess: (response) => {
        replaceBanking(response);
      }
    });
  }

  function handleNext() {
    const nextState = {
      ...state,
      current_step: "menu" as const
    };

    setCurrentStep("menu");
    saveOnboardingState(nextState);
    router.push("/menu");
  }

  return (
    <div className="grid gap-6">
      <UploadPreparation title="Prepare the banking document">
        Prepare a RIB or bank account document. After upload, we will extract the
        account holder, IBAN, BIC, and bank name when available. If something cannot
        be read, you can fill the missing fields manually.
      </UploadPreparation>

      <UploadDropzone
        title="Upload banking document"
        description="RIB, PDF, photo, or screenshot. The document is parsed as soon as it is selected."
        mode="single"
        accept="application/pdf,image/*"
        files={selectedFiles}
        loading={parseBankAccountMutation.isPending}
        error={
          parseBankAccountMutation.error
            ? formatParseError(parseBankAccountMutation.error, "banking")
            : null
        }
        onFilesChange={handleFilesChange}
      />

      {parseBankAccountMutation.isSuccess ? (
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Document parsed. Review and edit the banking fields below.</span>
        </div>
      ) : null}

      {parseBankAccountMutation.isError ? (
        <div
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Upload another document or fill the banking fields manually to continue.
          </span>
        </div>
      ) : null}

      <BankingForm />

      <div className="flex justify-end">
        <Button type="button" onClick={handleNext}>
          Next
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
