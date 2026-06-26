"use client";

import { AlertTriangle, CheckCircle2, ChevronDown } from "lucide-react";
import { ReactNode, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollToTopButton } from "@/components/onboarding/scroll-to-top-button";
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
  warningCount: number;
};

type WarningTarget = {
  id: string;
  groupKey: string;
};

const missingPlaceholder = "Not provided";
const warningButtonClassName =
  "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 hover:text-amber-950";

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
  const [activeWarningIndex, setActiveWarningIndex] = useState(0);
  const menuGroups = useMemo(
    () => groupMenuItems(menu.menu.items),
    [menu.menu.items]
  );
  const menuWarningCount = useMemo(
    () =>
      menu.menu.items.reduce(
        (count, item) => count + getMenuItemMissingFields(item).length,
        0
      ),
    [menu.menu.items]
  );
  const warningTargets = useMemo(() => getWarningTargets(menuGroups), [menuGroups]);

  const legalReady = Boolean(legal.legal_name && (legal.siren || legal.siret));
  const bankingReady = Boolean(banking.account_holder && banking.iban && banking.bic);
  const menuReady = menu.menu.items.length > 0 && menuWarningCount === 0;

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

  function handleGoToNextMenuWarning() {
    if (warningTargets.length === 0) {
      return;
    }

    const targetIndex = activeWarningIndex % warningTargets.length;
    const target = warningTargets[targetIndex];

    setOpenBlocks((current) => ({
      ...current,
      menu: true
    }));
    setOpenGroups((current) => ({
      ...current,
      [target.groupKey]: true
    }));
    setActiveWarningIndex((targetIndex + 1) % warningTargets.length);

    requestAnimationFrame(() => {
      document
        .getElementById(target.id)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
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
        warningCount={menuWarningCount}
        onGoToWarning={
          menuWarningCount > 0 ? handleGoToNextMenuWarning : undefined
        }
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
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold tracking-normal">
                          {group.title}
                        </h3>
                        {group.warningCount > 0 ? (
                          <WarningCountBadge count={group.warningCount} />
                        ) : null}
                      </div>
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
                      {group.items.map((item) => {
                        const missingFields = getMenuItemMissingFields(item);

                        return (
                          <div
                            key={item.id}
                            id={getWarningTargetId(item.id)}
                            className={cn(
                              "grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_1.5fr_120px]",
                              missingFields.length > 0
                                ? "border-amber-300 bg-amber-50/50"
                                : "border-transparent bg-muted/40"
                            )}
                          >
                            <ReadOnlyField
                              label="Name"
                              value={item.name}
                              required
                            />
                            <ReadOnlyField
                              label="Description"
                              value={item.description}
                            />
                            <ReadOnlyField
                              label="Price"
                              value={formatEuroPrice(item.price)}
                              required
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </SummarySection>

      <ScrollToTopButton />
    </div>
  );
}

function SummarySection({
  title,
  description,
  ready,
  warningCount = 0,
  onGoToWarning,
  isOpen,
  onToggle,
  children
}: {
  title: string;
  description: string;
  ready: boolean;
  warningCount?: number;
  onGoToWarning?: () => void;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{title}</CardTitle>
            {warningCount > 0 ? <WarningCountBadge count={warningCount} /> : null}
          </div>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge ready={ready} />
          {onGoToWarning ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={warningButtonClassName}
              onClick={onGoToWarning}
            >
              Next warning ({warningCount})
            </Button>
          ) : null}
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
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium",
        ready
          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
          : "border-amber-300 bg-amber-50 text-amber-950"
      )}
    >
      {ready ? (
        <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
      ) : (
        <AlertTriangle className="size-4 text-amber-600" aria-hidden="true" />
      )}
      {ready ? "Ready" : "Not provided"}
    </div>
  );
}

function WarningCountBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-950">
      {count} warning{count === 1 ? "" : "s"}
    </span>
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

function ReadOnlyField({
  label,
  value,
  required = false
}: {
  label: string;
  value: string;
  required?: boolean;
}) {
  const isMissing = required && value.trim().length === 0;

  return (
    <div
      className={cn(
        "rounded-md border p-3",
        isMissing
          ? "border-amber-300 bg-amber-50 text-amber-950"
          : "border-border bg-muted/40"
      )}
    >
      <p
        className={cn(
          "text-xs font-medium uppercase tracking-normal",
          isMissing ? "text-amber-800" : "text-muted-foreground"
        )}
      >
        {label}
        {isMissing ? " Warning" : ""}
      </p>
      <p className="mt-2 text-sm text-foreground">
        {value.trim() || (
          <span className={isMissing ? "text-amber-900" : "text-muted-foreground"}>
            {isMissing ? "Not Provided" : missingPlaceholder}
          </span>
        )}
      </p>
    </div>
  );
}

function formatEuroPrice(value: string) {
  const price = value
    .replace(/[€£$]/g, "")
    .replace(/\bEUR\b/gi, "")
    .trim();

  return price ? `${price} EUR` : "";
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
    items: groupItems,
    warningCount: groupItems.reduce(
      (count, item) => count + getMenuItemMissingFields(item).length,
      0
    )
  }));
}

function getMenuItemMissingFields(item: MenuItem) {
  const missingFields: string[] = [];

  if (item.name.trim().length === 0) {
    missingFields.push("name");
  }

  if (item.price.trim().length === 0) {
    missingFields.push("price");
  }

  return missingFields;
}

function getWarningTargets(groups: MenuGroup[]): WarningTarget[] {
  return groups.flatMap((group) =>
    group.items
      .filter((item) => getMenuItemMissingFields(item).length > 0)
      .map((item) => ({
        id: getWarningTargetId(item.id),
        groupKey: group.key
      }))
  );
}

function getWarningTargetId(itemId: string) {
  return `menu-summary-warning-${itemId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}
