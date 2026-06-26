"use client";

import { AlertTriangle, CheckCircle2, ChevronDown } from "lucide-react";
import { ReactNode, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import type { MenuItem } from "@/lib/api/types";
import { useOnboardingState } from "@/lib/onboarding-state";
import { cn } from "@/lib/utils";

type CollapsibleKey = "legal" | "banking" | "menu";

type MenuGroup = {
  key: string;
  title: string;
  items: MenuItem[];
};

const missingPlaceholder = "Not provided";

export function RestaurantSummary() {
  const {
    state: { legal, banking, menu }
  } = useOnboardingState();
  const [openBlocks, setOpenBlocks] = useState<Record<CollapsibleKey, boolean>>({
    legal: true,
    banking: true,
    menu: true
  });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const menuGroups = useMemo(
    () => groupMenuItems(menu.menu.items),
    [menu.menu.items]
  );

  const legalReady = Boolean(legal.legal_name && (legal.siren || legal.siret));
  const bankingReady = Boolean(banking.account_holder && banking.iban && banking.bic);
  const menuReady = menu.menu.items.some((item) => item.name && item.price);

  function toggleBlock(block: CollapsibleKey) {
    setOpenBlocks((current) => ({
      ...current,
      [block]: !current[block]
    }));
  }

  function toggleGroup(groupKey: string) {
    setOpenGroups((current) => ({
      ...current,
      [groupKey]: !(current[groupKey] ?? true)
    }));
  }

  return (
    <div className="grid gap-6">
      <SummarySection
        title="Legal"
        description="Registration details"
        ready={legalReady}
        isOpen={openBlocks.legal}
        onToggle={() => toggleBlock("legal")}
      >
        <FieldGrid
          fields={[
            ["Legal name", legal.legal_name],
            ["SIREN", legal.siren],
            ["SIRET", legal.siret],
            ["Legal form", legal.legal_form],
            ["Registered address", legal.legal_address],
            ["Legal representative", legal.legal_representative]
          ]}
        />
      </SummarySection>

      <SummarySection
        title="Banking"
        description="Bank account details"
        ready={bankingReady}
        isOpen={openBlocks.banking}
        onToggle={() => toggleBlock("banking")}
      >
        <FieldGrid
          fields={[
            ["Account holder", banking.account_holder],
            ["Bank name", banking.bank_name],
            ["IBAN", banking.iban],
            ["BIC", banking.bic]
          ]}
        />
      </SummarySection>

      <SummarySection
        title="Menu"
        description="Grouped menu items"
        ready={menuReady}
        isOpen={openBlocks.menu}
        onToggle={() => toggleBlock("menu")}
      >
        {menuGroups.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            No menu items saved
          </div>
        ) : (
          <div className="grid gap-3">
            {menuGroups.map((group) => {
              const groupOpen = openGroups[group.key] ?? true;

              return (
                <section key={group.key} className="rounded-md border border-border">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    onClick={() => toggleGroup(group.key)}
                    aria-expanded={groupOpen}
                  >
                    <div>
                      <h3 className="text-base font-semibold tracking-normal">
                        {group.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {group.items.length} item
                        {group.items.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        groupOpen ? "rotate-180" : null
                      )}
                      aria-hidden="true"
                    />
                  </button>

                  {groupOpen ? (
                    <div className="grid gap-3 border-t border-border p-4">
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          className="grid gap-3 rounded-md bg-muted/40 p-3 md:grid-cols-[1fr_1.5fr_120px]"
                        >
                          <ReadOnlyField label="Name" value={item.name} />
                          <ReadOnlyField
                            label="Description"
                            value={item.description}
                          />
                          <ReadOnlyField label="Price" value={item.price} />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </SummarySection>
    </div>
  );
}

function SummarySection({
  title,
  description,
  ready,
  isOpen,
  onToggle,
  children
}: {
  title: string;
  description: string;
  ready: boolean;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge ready={ready} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggle}
            aria-expanded={isOpen}
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                isOpen ? "rotate-180" : null
              )}
              aria-hidden="true"
            />
          </Button>
        </div>
      </CardHeader>
      {isOpen ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}

function StatusBadge({ ready }: { ready: boolean }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium">
      {ready ? (
        <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
      ) : (
        <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
      )}
      {ready ? "Ready" : "Couldn't parse"}
    </div>
  );
}

function FieldGrid({ fields }: { fields: Array<[string, string]> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map(([label, value]) => (
        <ReadOnlyField key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3">
      <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm text-foreground">
        {value.trim() || (
          <span className="text-muted-foreground">{missingPlaceholder}</span>
        )}
      </p>
    </div>
  );
}

function groupMenuItems(items: MenuItem[]): MenuGroup[] {
  const groups = new Map<string, MenuItem[]>();

  for (const item of [...items].sort((a, b) => a.order - b.order)) {
    const groupKey = item.group_name.trim();
    const title = groupKey || "Ungrouped";
    groups.set(title, [...(groups.get(title) ?? []), item]);
  }

  return Array.from(groups.entries()).map(([title, groupItems]) => ({
    key: title,
    title,
    items: groupItems
  }));
}
