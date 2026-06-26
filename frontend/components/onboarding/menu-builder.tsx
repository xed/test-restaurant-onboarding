"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";

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
};

const editableFields: Array<{
  name: keyof Pick<MenuItem, "name" | "description" | "price">;
  label: string;
}> = [
  { name: "name", label: "Name" },
  { name: "description", label: "Description" },
  { name: "price", label: "Price" }
];

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
  const groups = useMemo(
    () => buildGroups(items, menuGroups),
    [items, menuGroups]
  );

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Menu builder</CardTitle>
        <CardDescription>
          Group parsed items, fix fields, add missing items, and drag items between
          groups.
        </CardDescription>
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
          <Button type="button" onClick={handleAddGroup}>
            <Plus className="size-4" aria-hidden="true" />
            Group
          </Button>
        </div>

        {groups.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
            Upload menu files or create a group to start building the menu.
          </div>
        ) : (
          <div className="grid gap-4">
            {groups.map((group) => (
              <section
                key={group.key || "ungrouped"}
                className="rounded-md border border-border"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDropOnGroup(group.key);
                }}
              >
                <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold tracking-normal">
                      {group.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {group.items.length} item{group.items.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddItem(group.key)}
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      Item
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteGroup(group.key)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      Group
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 p-4">
                  {group.items.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                      Drop items here or add a new item.
                    </div>
                  ) : (
                    group.items.map((item) => (
                      <div
                        key={item.id}
                        draggable
                        className={cn(
                          "grid gap-3 rounded-md border border-border bg-muted/40 p-3",
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
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                        <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr_140px]">
                          {editableFields.map((field) => (
                            <label key={field.name} className="grid gap-2">
                              <span className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                                {field.label}
                              </span>
                              <input
                                value={item[field.name]}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  updateMenuItem(item.id, {
                                    [field.name]: event.target.value
                                  } as Partial<MenuItem>)
                                }
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function buildGroups(items: MenuItem[], menuGroups: string[]): MenuGroup[] {
  const sortedItems = [...items].sort((a, b) => a.order - b.order);
  const groupNames = new Set<string>();
  const hasUngrouped = sortedItems.some((item) => item.group_name.trim() === "");

  for (const groupName of menuGroups) {
    if (groupName.trim()) {
      groupNames.add(groupName);
    }
  }

  for (const item of sortedItems) {
    if (item.group_name.trim()) {
      groupNames.add(item.group_name);
    }
  }

  const groups: MenuGroup[] = Array.from(groupNames).map((groupName) => ({
    key: groupName,
    title: groupName,
    isUngrouped: false,
    items: sortedItems.filter((item) => item.group_name === groupName)
  }));

  if (hasUngrouped) {
    groups.push({
      key: "",
      title: "Ungrouped",
      isUngrouped: true,
      items: sortedItems.filter((item) => item.group_name.trim() === "")
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

function normalizeGroupName(groupName: string) {
  return groupName.trim().toLocaleLowerCase();
}

function createMenuItemId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
