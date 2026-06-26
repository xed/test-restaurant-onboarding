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

import { LegalForm } from "@/components/onboarding/legal-form";
import { UploadPreparation } from "@/components/onboarding/upload-preparation";
import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/components/upload-dropzone";
import { formatParseError } from "@/lib/api/error-messages";
import { useParseLegalMutation } from "@/lib/api/mutations";
import type { LegalParseResponse } from "@/lib/api/types";
import { useOnboardingState } from "@/lib/onboarding-state";
import { saveOnboardingState } from "@/lib/onboarding-storage";

export function LegalScreen() {
  const router = useRouter();
  const { state, replaceLegal, setCurrentStep, setNavigationLocked } =
    useOnboardingState();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const parseLegalMutation = useParseLegalMutation();
  const fileStatus = getUploadFileStatus({
    isPending: parseLegalMutation.isPending,
    isError: parseLegalMutation.isError,
    response: parseLegalMutation.data
  });

  useEffect(() => {
    setNavigationLocked(parseLegalMutation.isPending);

    return () => setNavigationLocked(false);
  }, [parseLegalMutation.isPending, setNavigationLocked]);

  function handleFilesChange(files: File[]) {
    setSelectedFiles(files);
    parseLegalMutation.reset();

    const [file] = files;
    if (!file) {
      return;
    }

    parseLegalMutation.mutate(file, {
      onSuccess: (response) => {
        if (getLegalResponseStatus(response) !== "empty") {
          replaceLegal(response);
        }
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
        getFileClassName={() => getUploadFileClassName(fileStatus)}
        renderFileMeta={() => renderUploadFileStatus(fileStatus)}
        onFilesChange={handleFilesChange}
      />

      {parseLegalMutation.isSuccess && fileStatus !== "empty" ? (
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {fileStatus === "partial"
              ? "Document partially parsed. Review and complete the legal fields below."
              : "Document parsed. Review and edit the legal fields below."}
          </span>
        </div>
      ) : null}

      {parseLegalMutation.isError || fileStatus === "empty" ? (
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
        <Button
          type="button"
          disabled={parseLegalMutation.isPending}
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
  response?: LegalParseResponse;
}): UploadFileStatus {
  if (isPending) {
    return "uploading";
  }

  if (isError) {
    return "error";
  }

  if (response) {
    return getLegalResponseStatus(response);
  }

  return null;
}

function getLegalResponseStatus(response: LegalParseResponse): UploadFileStatus {
  const fieldGroups = [
    [response.legal_name],
    [response.siren, response.siret],
    [response.legal_form],
    [response.legal_address],
    [response.legal_representative]
  ];
  const filledGroupCount = fieldGroups.filter((group) =>
    group.some((value) => value.trim().length > 0)
  ).length;

  if (filledGroupCount === 0) {
    return "empty";
  }

  if (filledGroupCount === fieldGroups.length) {
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
