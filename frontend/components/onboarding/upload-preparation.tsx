import { Info } from "lucide-react";

type UploadPreparationProps = {
  title: string;
  children: string;
};

export function UploadPreparation({ title, children }: UploadPreparationProps) {
  return (
    <section className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-4 text-sm">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-primary">
        <Info className="size-4" aria-hidden="true" />
      </div>
      <div className="grid gap-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="leading-6 text-muted-foreground">{children}</p>
      </div>
    </section>
  );
}
