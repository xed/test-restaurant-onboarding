import { UploadCloud } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type UploadPlaceholderProps = {
  title: string;
  description: string;
  multiple?: boolean;
};

export function UploadPlaceholder({
  title,
  description,
  multiple = false
}: UploadPlaceholderProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <UploadCloud className="size-6" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-normal">{title}</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
        </div>
        <p className="text-xs font-medium text-muted-foreground">
          {multiple ? "Multiple files supported in a later task" : "Single file upload in a later task"}
        </p>
      </CardContent>
    </Card>
  );
}
