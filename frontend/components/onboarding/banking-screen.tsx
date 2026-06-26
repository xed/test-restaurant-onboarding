"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  XCircle
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BankingForm } from "@/components/onboarding/banking-form";
import { UploadPreparation } from "@/components/onboarding/upload-preparation";
import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/components/upload-dropzone";
import { formatParseError } from "@/lib/api/error-messages";
import { useParseBankAccountMutation } from "@/lib/api/mutations";
import type { BankAccountParseResponse } from "@/lib/api/types";
import { useOnboardingState } from "@/lib/onboarding-state";
import { saveOnboardingState } from "@/lib/onboarding-storage";

export function BankingScreen() {
  const router = useRouter();
  const { state, replaceBanking, setCurrentStep, setNavigationLocked } =
    useOnboardingState();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const parseBankAccountMutation = useParseBankAccountMutation();
  const fileStatus = getUploadFileStatus({
    isPending: parseBankAccountMutation.isPending,
    isError: parseBankAccountMutation.isError,
    response: parseBankAccountMutation.data
  });

  useEffect(() => {
    setNavigationLocked(parseBankAccountMutation.isPending);

    return () => setNavigationLocked(false);
  }, [parseBankAccountMutation.isPending, setNavigationLocked]);

  function handleFilesChange(files: File[]) {
    setSelectedFiles(files);
    parseBankAccountMutation.reset();

    const [file] = files;
    if (!file) {
      return;
    }

    parseBankAccountMutation.mutate(file, {
      onSuccess: (response) => {
        if (getBankingResponseStatus(response) !== "empty") {
          replaceBanking(response);
        }
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
        getFileClassName={() => getUploadFileClassName(fileStatus)}
        renderFileMeta={() => renderUploadFileStatus(fileStatus)}
        onFilesChange={handleFilesChange}
      />

      {parseBankAccountMutation.isSuccess && fileStatus !== "empty" ? (
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {fileStatus === "partial"
              ? "Document partially parsed. Review and complete the banking fields below."
              : "Document parsed. Review and edit the banking fields below."}
          </span>
        </div>
      ) : null}

      {parseBankAccountMutation.isError || fileStatus === "empty" ? (
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
        <Button
          type="button"
          disabled={parseBankAccountMutation.isPending}
          onClick={handleNext}
        >
          Next
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

type UploadFileStatus =
  | "uploading"
  | "complete"
  | "partial"
  | "empty"
  | "error"
  | null;

function getUploadFileStatus({
  isPending,
  isError,
  response
}: {
  isPending: boolean;
  isError: boolean;
  response?: BankAccountParseResponse;
}): UploadFileStatus {
  if (isPending) {
    return "uploading";
  }

  if (isError) {
    return "error";
  }

  if (response) {
    return getBankingResponseStatus(response);
  }

  return null;
}

function getBankingResponseStatus(
  response: BankAccountParseResponse
): UploadFileStatus {
  const values = [
    response.account_holder,
    response.bank_name,
    response.iban,
    response.bic
  ];
  const filledCount = values.filter((value) => value.trim().length > 0).length;

  if (filledCount === 0) {
    return "empty";
  }

  if (filledCount === values.length) {
    return "complete";
  }

  return "partial";
}

function getUploadFileClassName(status: UploadFileStatus) {
  switch (status) {
    case "uploading":
    case "partial":
      return "border-amber-300 bg-amber-50";
    case "complete":
      return "border-emerald-300 bg-emerald-50";
    case "empty":
    case "error":
      return "border-destructive/40 bg-destructive/10";
    default:
      return undefined;
  }
}

function renderUploadFileStatus(status: UploadFileStatus) {
  switch (status) {
    case "uploading":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          Parsing
        </span>
      );
    case "partial":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
          <AlertCircle className="size-3" aria-hidden="true" />
          Partial
        </span>
      );
    case "complete":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="size-3" aria-hidden="true" />
          Done
        </span>
      );
    case "empty":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
          <XCircle className="size-3" aria-hidden="true" />
          No data found
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
          <XCircle className="size-3" aria-hidden="true" />
          Failed
        </span>
      );
    default:
      return null;
  }
}
