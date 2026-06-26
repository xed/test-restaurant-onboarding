"use client";

import { AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MenuBuilder } from "@/components/onboarding/menu-builder";
import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/components/upload-dropzone";
import { formatParseError } from "@/lib/api/error-messages";
import { useParseMenuMutation } from "@/lib/api/mutations";
import { useOnboardingState } from "@/lib/onboarding-state";
import { saveOnboardingState } from "@/lib/onboarding-storage";

export function MenuScreen() {
  const router = useRouter();
  const { state, replaceMenu, setCurrentStep, setMenuGroups } =
    useOnboardingState();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const parseMenuMutation = useParseMenuMutation();
  const parsedMenuItems = parseMenuMutation.data?.menu.items ?? [];

  function handleFilesChange(files: File[]) {
    setSelectedFiles(files);
    parseMenuMutation.reset();

    if (files.length === 0) {
      return;
    }

    parseMenuMutation.mutate(files, {
      onSuccess: (response) => {
        replaceMenu(response);
        setMenuGroups(getParsedGroupNames(response.menu.items));
      }
    });
  }

  function handleNext() {
    const nextState = {
      ...state,
      current_step: "restaurant" as const
    };

    setCurrentStep("restaurant");
    saveOnboardingState(nextState);
    router.push("/restaurant");
  }

  return (
    <div className="grid gap-6">
      <UploadDropzone
        title="Upload menu files"
        description="Upload one or more PDFs, photos, screenshots, or other menu files. Parsing starts as soon as files are selected."
        mode="multiple"
        files={selectedFiles}
        loading={parseMenuMutation.isPending}
        error={
          parseMenuMutation.error
            ? formatParseError(parseMenuMutation.error, "menu")
            : null
        }
        onFilesChange={handleFilesChange}
      />

      {parseMenuMutation.isSuccess ? (
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {parsedMenuItems.length > 0
              ? "Menu parsed. Review groups and edit items below."
              : "No menu items were found. Upload another file or build the menu manually below."}
          </span>
        </div>
      ) : null}

      {parseMenuMutation.isError ? (
        <div
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Upload again or build the menu manually to continue.</span>
        </div>
      ) : null}

      <MenuBuilder />

      <div className="flex justify-end">
        <Button type="button" onClick={handleNext}>
          Next
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function getParsedGroupNames(
  items: Array<{
    group_name: string;
  }>
) {
  return Array.from(
    new Set(
      items
        .map((item) => item.group_name.trim())
        .filter((groupName) => groupName.length > 0)
    )
  );
}
