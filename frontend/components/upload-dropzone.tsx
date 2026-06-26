"use client";

import {
  AlertCircle,
  FileText,
  Loader2,
  UploadCloud,
  X
} from "lucide-react";
import { ChangeEvent, DragEvent, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type UploadDropzoneProps = {
  title: string;
  description: string;
  mode: "single" | "multiple";
  accept?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: string | null;
  files?: File[];
  onFilesChange?: (files: File[]) => void;
};

export function UploadDropzone({
  title,
  description,
  mode,
  accept,
  disabled = false,
  loading = false,
  error,
  files,
  onFilesChange
}: UploadDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [internalFiles, setInternalFiles] = useState<File[]>([]);
  const [clientError, setClientError] = useState<string | null>(null);
  const selectedFiles = files ?? internalFiles;
  const isDisabled = disabled || loading;
  const allowsMultiple = mode === "multiple";
  const displayedError = clientError ?? error;

  function commitFiles(nextFiles: File[], options?: { showEmptyError?: boolean }) {
    if (nextFiles.length === 0) {
      setClientError(
        options?.showEmptyError
          ? allowsMultiple
            ? "No files were selected. Choose one or more files to parse, or continue manually."
            : "No file was selected. Choose a file to parse, or continue manually."
          : null
      );

      if (!files) {
        setInternalFiles([]);
      }

      onFilesChange?.([]);
      return;
    }

    if (accept) {
      const rejectedFiles = nextFiles.filter((file) => !isAcceptedFile(file, accept));

      if (rejectedFiles.length > 0) {
        setClientError(
          `Unsupported file type: ${formatFileNames(
            rejectedFiles
          )}. Use ${formatAcceptLabel(accept)}.`
        );
        return;
      }
    }

    const normalizedFiles = allowsMultiple ? nextFiles : nextFiles.slice(0, 1);
    setClientError(null);

    if (!files) {
      setInternalFiles(normalizedFiles);
    }

    onFilesChange?.(normalizedFiles);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    commitFiles(Array.from(event.target.files ?? []), { showEmptyError: true });
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (isDisabled) {
      return;
    }

    commitFiles(Array.from(event.dataTransfer.files), { showEmptyError: true });
  }

  function clearFiles() {
    commitFiles([]);
    inputRef.current?.focus();
  }

  return (
    <Card
      className={cn(
        "border-dashed transition-colors",
        isDragging && !isDisabled ? "border-primary bg-accent/50" : null,
        isDisabled ? "opacity-70" : null,
        displayedError ? "border-destructive" : null
      )}
    >
      <CardContent
        className="grid gap-5 p-6 sm:p-8"
        onDragEnter={(event) => {
          event.preventDefault();
          if (!isDisabled) {
            setIsDragging(true);
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          const relatedTarget = event.relatedTarget;
          if (
            !(relatedTarget instanceof Node) ||
            !event.currentTarget.contains(relatedTarget)
          ) {
            setIsDragging(false);
          }
        }}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple={allowsMultiple}
          disabled={isDisabled}
          className="sr-only"
          onChange={handleInputChange}
        />

        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className={cn(
              "flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground",
              displayedError ? "bg-destructive/10 text-destructive" : null
            )}
          >
            {loading ? (
              <Loader2 className="size-6 animate-spin" aria-hidden="true" />
            ) : (
              <UploadCloud className="size-6" aria-hidden="true" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-normal">{title}</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              {description}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isDisabled}
              onClick={() => inputRef.current?.click()}
            >
              {selectedFiles.length > 0
                ? "Choose again"
                : allowsMultiple
                  ? "Choose files"
                  : "Choose file"}
            </Button>
            {selectedFiles.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isDisabled}
                onClick={clearFiles}
              >
                <X className="size-4" aria-hidden="true" />
                Clear
              </Button>
            ) : null}
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            {selectedFiles.length === 0
              ? "No file selected yet"
              : allowsMultiple
                ? "Drop files here or choose one or more files"
                : "Drop a file here or choose a replacement file"}
          </p>
        </div>

        {displayedError ? (
          <div
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{displayedError}</span>
          </div>
        ) : null}

        {selectedFiles.length > 0 ? (
          <div className="grid gap-2">
            {selectedFiles.map((file) => (
              <div
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border bg-muted/40 p-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">{file.name}</span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isAcceptedFile(file: File, accept: string) {
  const rules = accept
    .split(",")
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean);

  if (rules.length === 0) {
    return true;
  }

  const fileType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();

  return rules.some((rule) => {
    if (rule.endsWith("/*")) {
      return fileType.startsWith(rule.slice(0, -1));
    }

    if (rule.startsWith(".")) {
      return fileName.endsWith(rule);
    }

    return fileType === rule;
  });
}

function formatFileNames(files: File[]) {
  const names = files.map((file) => file.name);

  if (names.length <= 2) {
    return names.join(", ");
  }

  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

function formatAcceptLabel(accept: string) {
  const labels = accept
    .split(",")
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean)
    .map((rule) => {
      if (rule === "application/pdf") {
        return "PDF";
      }

      if (rule === "image/*") {
        return "image";
      }

      return rule;
    });

  if (labels.length <= 1) {
    return labels[0] ?? "a supported file type";
  }

  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
}
