"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  XCircle
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { MenuBuilder } from "@/components/onboarding/menu-builder";
import { UploadPreparation } from "@/components/onboarding/upload-preparation";
import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/components/upload-dropzone";
import { parseMenu } from "@/lib/api/client";
import { formatParseError } from "@/lib/api/error-messages";
import type { MenuItem } from "@/lib/api/types";
import { useOnboardingState } from "@/lib/onboarding-state";
import { saveOnboardingState } from "@/lib/onboarding-storage";

type MenuFileUpload = {
  key: string;
  status: "uploading" | "success" | "error";
  itemCount?: number;
  message?: string;
};

export function MenuScreen() {
  const router = useRouter();
  const { state, appendMenu, replaceMenu, setCurrentStep } = useOnboardingState();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileUploads, setFileUploads] = useState<MenuFileUpload[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const activeRunIdRef = useRef(0);

  const hasAddedItems = fileUploads.some(
    (upload) => upload.status === "success" && (upload.itemCount ?? 0) > 0
  );
  const hasEmptySuccessfulUploads = fileUploads.some(
    (upload) => upload.status === "success" && upload.itemCount === 0
  );
  const failedUploads = fileUploads.filter((upload) => upload.status === "error");

  function handleFilesChange(files: File[]) {
    const nextUploads = files.map((file, index) => ({
      key: getFileKey(file, index),
      status: "uploading" as const
    }));

    setSelectedFiles(files);
    setFileUploads(nextUploads);
    activeRunIdRef.current += 1;

    if (files.length === 0) {
      setIsParsing(false);
      return;
    }

    void parseFilesInParallel(files, nextUploads, activeRunIdRef.current);
  }

  async function parseFilesInParallel(
    files: File[],
    initialUploads: MenuFileUpload[],
    runId: number
  ) {
    setIsParsing(true);

    await Promise.all(
      files.map(async (file, index) => {
        const uploadKey = initialUploads[index].key;

        try {
          const response = await parseMenu([file]);

          if (activeRunIdRef.current !== runId) {
            return;
          }

          appendMenu(response);
          setFileUploads((current) =>
            updateFileUpload(current, uploadKey, {
              status: "success",
              itemCount: response.menu.items.length,
              message:
                response.menu.items.length > 0
                  ? `${response.menu.items.length} item${
                      response.menu.items.length === 1 ? "" : "s"
                    } added`
                  : "No items found"
            })
          );
        } catch (error) {
          if (activeRunIdRef.current !== runId) {
            return;
          }

          setFileUploads((current) =>
            updateFileUpload(current, uploadKey, {
              status: "error",
              message: formatParseError(error, "menu")
            })
          );
        }
      })
    );

    if (activeRunIdRef.current === runId) {
      setIsParsing(false);
    }
  }

  function handleNext() {
    const cleanedItems = normalizeMenuItemsForNext(state.menu.menu.items);
    const nextState = {
      ...state,
      menu: {
        menu: {
          items: cleanedItems
        }
      },
      current_step: "restaurant" as const
    };

    replaceMenu(nextState.menu);
    setCurrentStep("restaurant");
    saveOnboardingState(nextState);
    router.push("/restaurant");
  }

  return (
    <div className="grid gap-6">
      <UploadPreparation title="Prepare the menu files">
        Upload one or more menu files, such as PDFs, photos, or scans. We will group
        dishes into menu sections and extract names, descriptions, and prices where
        possible. You can add, remove, rename, and reorganize groups and items after
        parsing.
      </UploadPreparation>

      <UploadDropzone
        title="Upload menu files"
        description="Upload one or more PDFs, photos, screenshots, or other menu files. Each file starts parsing in its own request as soon as it is selected."
        mode="multiple"
        files={selectedFiles}
        loading={isParsing}
        renderFileMeta={(file, index) => {
          const upload = fileUploads.find(
            (item) => item.key === getFileKey(file, index)
          );

          return renderFileUploadStatus(upload);
        }}
        onFilesChange={handleFilesChange}
      />

      {hasAddedItems || hasEmptySuccessfulUploads ? (
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {hasAddedItems
              ? "Parsed menu items are being added as each file completes. Review groups and edit items below."
              : "No menu items were found in the completed files. Upload another file or build the menu manually below."}
          </span>
        </div>
      ) : null}

      {failedUploads.length > 0 ? (
        <div
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {failedUploads.length} file{failedUploads.length === 1 ? "" : "s"} could
            not be parsed. Upload again or build the menu manually to continue.
          </span>
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

function updateFileUpload(
  uploads: MenuFileUpload[],
  key: string,
  patch: Partial<MenuFileUpload>
) {
  return uploads.map((upload) =>
    upload.key === key
      ? {
          ...upload,
          ...patch
        }
      : upload
  );
}

function getFileKey(file: File, index: number) {
  return `${file.name}-${file.size}-${file.lastModified}-${index}`;
}

function renderFileUploadStatus(upload?: MenuFileUpload) {
  if (!upload) {
    return null;
  }

  switch (upload.status) {
    case "uploading":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          Parsing
        </span>
      );
    case "success":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
          <CheckCircle2 className="size-3" aria-hidden="true" />
          {upload.message ?? "Done"}
        </span>
      );
    case "error":
      return (
        <span
          className="inline-flex max-w-60 items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive"
          title={upload.message}
        >
          <XCircle className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">Failed</span>
        </span>
      );
  }
}

function normalizeMenuItemsForNext(items: MenuItem[]) {
  return items
    .filter((item) => hasAnyMenuItemField(item))
    .map((item, index) => ({
      ...item,
      order: index
    }));
}

function hasAnyMenuItemField(item: MenuItem) {
  return [item.name, item.description, item.price].some(
    (value) => value.trim().length > 0
  );
}
