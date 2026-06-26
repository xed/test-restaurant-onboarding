"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { ChevronDown, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";

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

type MenuGroup = {
  key: string;
  title: string;
  items: MenuItem[];
  isUngrouped: boolean;
  warningCount: number;
};

type WarningTarget = {
  id: string;
  groupKey: string;
};

const editableFields: Array<{
  name: keyof Pick<MenuItem, "name" | "description" | "price">;
  label: string;
}> = [
  { name: "name", label: "Name" },
  { name: "description", label: "Description" },
  { name: "price", label: "Price" }
];

const addButtonClassName =
  "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 hover:text-emerald-800";
const deleteButtonClassName =
  "border-red-500/40 bg-red-500/10 text-red-700 hover:bg-red-500/15 hover:text-red-800";
const warningButtonClassName =
  "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 hover:text-amber-950";

export function MenuBuilder() {
  const {
    state: {
      menu: {
        menu: { items }
      },
      menu_groups: menuGroups
    },
    replaceMenu,
    setMenuGroups,
    updateMenuItem
  } = useOnboardingState();
  const [newGroupName, setNewGroupName] = useState("");
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [activeWarningIndex, setActiveWarningIndex] = useState(0);
  const groups = useMemo(
    () => buildGroups(items, menuGroups),
    [items, menuGroups]
  );
  const warningCount = useMemo(
    () =>
      items.reduce((count, item) => count + getMenuItemMissingFields(item).length, 0),
    [items]
  );
  const warningTargets = useMemo(() => getWarningTargets(groups), [groups]);

  function commitItems(nextItems: MenuItem[]) {
    replaceMenu({
      menu: {
        items: normalizeOrder(nextItems)
      }
    });
  }

  function handleAddGroup() {
    const groupName = newGroupName.trim();
    if (!groupName) {
      return;
    }

    const existingNames = new Set([
      ...menuGroups.map(normalizeGroupName),
      ...items.map((item) => normalizeGroupName(item.group_name)).filter(Boolean)
    ]);
    if (!existingNames.has(normalizeGroupName(groupName))) {
      setMenuGroups([...menuGroups, groupName]);
    }

    setNewGroupName("");
  }

  function handleDeleteGroup(groupKey: string) {
    if (groupKey === "") {
      commitItems(items.filter((item) => item.group_name.trim() !== ""));
      return;
    }

    setMenuGroups(menuGroups.filter((group) => group !== groupKey));
    commitItems(items.filter((item) => item.group_name !== groupKey));
  }

  function handleRenameGroup(groupKey: string, nextName: string) {
    const normalizedNextName = nextName.trim();
    if (normalizedNextName === groupKey) {
      return;
    }

    const nextGroups = menuGroups.filter((group) => group !== groupKey);

    if (
      normalizedNextName &&
      !nextGroups.some(
        (group) => normalizeGroupName(group) === normalizeGroupName(normalizedNextName)
      )
    ) {
      nextGroups.push(normalizedNextName);
    }

    setMenuGroups(nextGroups);
    commitItems(
      items.map((item) =>
        isItemInGroup(item, groupKey)
          ? {
              ...item,
              group_name: normalizedNextName
            }
          : item
      )
    );
  }

  function handleAddItem(groupKey: string) {
    commitItems([
      ...items,
      {
        id: createMenuItemId(),
        name: "",
        description: "",
        price: "",
        group_name: groupKey,
        order: items.length
      }
    ]);
  }

  function handleDeleteItem(itemId: string) {
    commitItems(items.filter((item) => item.id !== itemId));
  }

  function handleDropOnGroup(groupKey: string) {
    if (!draggedItemId) {
      return;
    }

    const draggedItem = items.find((item) => item.id === draggedItemId);
    if (!draggedItem) {
      return;
    }

    const remainingItems = items.filter((item) => item.id !== draggedItemId);
    commitItems([
      ...remainingItems,
      {
        ...draggedItem,
        group_name: groupKey
      }
    ]);
    setDraggedItemId(null);
  }

  function handleDropOnItem(targetItemId: string) {
    if (!draggedItemId || draggedItemId === targetItemId) {
      return;
    }

    const draggedItem = items.find((item) => item.id === draggedItemId);
    const targetItem = items.find((item) => item.id === targetItemId);
    if (!draggedItem || !targetItem) {
      return;
    }

    const nextItems = items.filter((item) => item.id !== draggedItemId);
    const targetIndex = nextItems.findIndex((item) => item.id === targetItemId);
    nextItems.splice(targetIndex, 0, {
      ...draggedItem,
      group_name: targetItem.group_name
    });
    commitItems(nextItems);
    setDraggedItemId(null);
  }

  function toggleGroup(groupKey: string) {
    setOpenGroups((current) => ({
      ...current,
      [groupKey]: !(current[groupKey] ?? true)
    }));
  }

  function handleGoToNextWarning() {
    if (warningTargets.length === 0) {
      return;
    }

    const targetIndex = activeWarningIndex % warningTargets.length;
    const target = warningTargets[targetIndex];

    setOpenGroups((current) => ({
      ...current,
      [target.groupKey]: true
    }));
    setActiveWarningIndex((targetIndex + 1) % warningTargets.length);

    requestAnimationFrame(() => {
      const element = document.getElementById(target.id);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      const input = element?.querySelector<HTMLInputElement>("[data-warning-input]");
      input?.focus({ preventScroll: true });
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Menu builder</CardTitle>
            </div>
            <CardDescription>
              Group parsed items, fix fields, add missing items, and drag items
              between groups.
            </CardDescription>
          </div>
          {warningCount > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={warningButtonClassName}
              onClick={handleGoToNextWarning}
            >
              Next warning ({warningCount})
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={newGroupName}
            className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="New group name"
            onChange={(event) => setNewGroupName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAddGroup();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            className={addButtonClassName}
            onClick={handleAddGroup}
          >
            <Plus className="size-4" aria-hidden="true" />
            Group
          </Button>
          <Button
            type="button"
            variant="outline"
            className={addButtonClassName}
            onClick={() => handleAddItem("")}
          >
            <Plus className="size-4" aria-hidden="true" />
            Item
          </Button>
        </div>

        {groups.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
            Upload menu files, create a group, or add an item to start building
            the menu.
          </div>
        ) : (
          <div className="grid gap-4">
            {groups.map((group) => {
              const groupOpen = openGroups[group.key] ?? true;

              return (
                <section
                  key={group.key || "ungrouped"}
                  className={cn(
                    "rounded-md border",
                    group.warningCount > 0
                      ? "border-amber-300 bg-amber-50/30"
                      : "border-border"
                  )}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleDropOnGroup(group.key);
                  }}
                >
                  <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="grid min-w-0 gap-1">
                      <GroupNameInput
                        group={group}
                        onCommit={(nextName) =>
                          handleRenameGroup(group.key, nextName)
                        }
                      />
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>
                          {group.items.length} item
                          {group.items.length === 1 ? "" : "s"}
                        </span>
                        {group.warningCount > 0 ? (
                          <WarningCountBadge count={group.warningCount} />
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => toggleGroup(group.key)}
                        aria-expanded={groupOpen}
                      >
                        <ChevronDown
                          className={cn(
                            "size-4 transition-transform",
                            groupOpen ? "rotate-180" : null
                          )}
                          aria-hidden="true"
                        />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={addButtonClassName}
                        onClick={() => handleAddItem(group.key)}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                        Item
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={deleteButtonClassName}
                        onClick={() => handleDeleteGroup(group.key)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        Group
                      </Button>
                    </div>
                  </div>
                  {groupOpen ? (
                    <div className="grid gap-3 p-4">
                      {group.items.length === 0 ? (
                        <div className="rounded-md border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                          Drop items here or add a new item.
                        </div>
                      ) : (
                        group.items.map((item) => {
                          const itemWarningCount = getMenuItemMissingFields(item).length;

                          return (
                            <div
                              id={getWarningTargetId(item.id)}
                              key={item.id}
                              draggable
                              className={cn(
                                "grid gap-3 rounded-md border p-3",
                                itemWarningCount > 0
                                  ? "border-amber-300 bg-amber-50/50"
                                  : "border-border bg-muted/40",
                                draggedItemId === item.id ? "opacity-50" : null
                              )}
                              onDragStart={() => setDraggedItemId(item.id)}
                              onDragEnd={() => setDraggedItemId(null)}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleDropOnItem(item.id);
                              }}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground">
                                  <GripVertical
                                    className="size-4 shrink-0"
                                    aria-hidden="true"
                                  />
                                  <span className="truncate">
                                    Drag to reorder or move groups
                                  </span>
                                  {itemWarningCount > 0 ? (
                                    <WarningCountBadge count={itemWarningCount} />
                                  ) : null}
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className={deleteButtonClassName}
                                  onClick={() => handleDeleteItem(item.id)}
                                >
                                  <Trash2 className="size-4" aria-hidden="true" />
                                </Button>
                              </div>
                              <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr_140px]">
                                {editableFields.map((field) => (
                                  <MenuItemInput
                                    key={field.name}
                                    item={item}
                                    field={field}
                                    warningInput={isRequiredFieldMissing(item, field.name)}
                                    onChange={(value) =>
                                      updateMenuItem(item.id, {
                                        [field.name]: value
                                      } as Partial<MenuItem>)
                                    }
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MenuItemInput({
  item,
  field,
  warningInput,
  onChange
}: {
  item: MenuItem;
  field: (typeof editableFields)[number];
  warningInput: boolean;
  onChange: (value: string) => void;
}) {
  const value = item[field.name];
  const displayValue = field.name === "price" ? sanitizePriceValue(value) : value;
  const isEmpty =
    field.name !== "description" && displayValue.trim().length === 0;
  const inputClassName = cn(
    "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
    isEmpty ? "border-amber-300 bg-amber-50/50 focus-visible:ring-amber-400" : null,
    field.name === "price" ? "pr-9" : null
  );

  return (
    <label className="grid gap-2">
      <span className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
        {field.label}
        {isEmpty ? " Warning" : ""}
      </span>
      {field.name === "price" ? (
        <span className="relative">
          <input
            value={displayValue}
            inputMode="decimal"
            className={inputClassName}
            data-warning-input={warningInput ? "true" : undefined}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onChange(sanitizePriceValue(event.target.value))
            }
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
            EUR
          </span>
        </span>
      ) : (
        <input
          value={displayValue}
          className={inputClassName}
          data-warning-input={warningInput ? "true" : undefined}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange(event.target.value)
          }
        />
      )}
    </label>
  );
}

function WarningCountBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-950">
      {count} warning{count === 1 ? "" : "s"}
    </span>
  );
}

function sanitizePriceValue(value: string) {
  return value.replace(/[€£$]/g, "").replace(/\bEUR\b/gi, "").trimStart();
}

function GroupNameInput({
  group,
  onCommit
}: {
  group: MenuGroup;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(group.isUngrouped ? "" : group.title);

  function commit() {
    onCommit(draft);
  }

  return (
    <label className="grid gap-1.5">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-normal text-muted-foreground">
        <Pencil className="size-3.5" aria-hidden="true" />
        Group name
      </span>
      <input
        value={draft}
        className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-base font-semibold tracking-normal outline-none transition-colors hover:border-primary/50 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="Ungrouped"
        aria-label="Group name"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

function buildGroups(items: MenuItem[], menuGroups: string[]): MenuGroup[] {
  const sortedItems = [...items].sort((a, b) => a.order - b.order);
  const groupNames = new Set<string>();
  const ungroupedItems = sortedItems.filter(isUngroupedItem);

  for (const groupName of menuGroups) {
    if (groupName.trim()) {
      groupNames.add(groupName);
    }
  }

  for (const item of sortedItems) {
    if (!isUngroupedItem(item)) {
      groupNames.add(item.group_name);
    }
  }

  const groups: MenuGroup[] = Array.from(groupNames).map((groupName) => ({
    key: groupName,
    title: groupName,
    isUngrouped: false,
    items: sortedItems.filter((item) => item.group_name === groupName),
    warningCount: sortedItems
      .filter((item) => item.group_name === groupName)
      .reduce((count, item) => count + getMenuItemMissingFields(item).length, 0)
  }));

  if (ungroupedItems.length > 0) {
    groups.push({
      key: "",
      title: "Ungrouped",
      isUngrouped: true,
      items: ungroupedItems,
      warningCount: ungroupedItems.reduce(
        (count, item) => count + getMenuItemMissingFields(item).length,
        0
      )
    });
  }

  return groups;
}

function normalizeOrder(items: MenuItem[]) {
  return items.map((item, index) => ({
    ...item,
    order: index
  }));
}

function isItemInGroup(item: MenuItem, groupKey: string) {
  if (groupKey === "") {
    return isUngroupedItem(item);
  }

  return item.group_name === groupKey;
}

function isUngroupedItem(item: MenuItem) {
  return item.group_name.trim() === "";
}

function normalizeGroupName(groupName: string) {
  return groupName.trim().toLocaleLowerCase();
}

function createMenuItemId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
  return `menu-warning-${itemId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function isRequiredFieldMissing(
  item: MenuItem,
  fieldName: keyof Pick<MenuItem, "name" | "description" | "price">
) {
  return (
    (fieldName === "name" || fieldName === "price") &&
    item[fieldName].trim().length === 0
  );
}
