"use client";

import { ChangeEvent } from "react";
import { Rows3 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import type { MenuItem } from "@/lib/api/types";
import { useOnboardingState } from "@/lib/onboarding-state";

const editableFields: Array<{
  name: keyof Pick<MenuItem, "name" | "description" | "price" | "group_name">;
  label: string;
}> = [
  { name: "name", label: "Name" },
  { name: "description", label: "Description" },
  { name: "price", label: "Price" },
  { name: "group_name", label: "Group" }
];

export function MenuStatePanel() {
  const {
    state: {
      menu: {
        menu: { items }
      }
    },
    updateMenuItem
  } = useOnboardingState();

  const groups = groupMenuItems(items);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Menu builder</CardTitle>
        <CardDescription>
          Parsed menu items are restored from local storage and can be edited here.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {groups.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
            No parsed menu items saved yet.
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.name} className="rounded-md border border-border">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Rows3 className="size-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-base font-semibold tracking-normal">{group.name}</h2>
              </div>
              <div className="grid gap-3 p-4">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-3 rounded-md bg-muted/40 p-3 lg:grid-cols-4"
                  >
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
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function groupMenuItems(items: MenuItem[]) {
  const groups = new Map<string, MenuItem[]>();

  for (const item of [...items].sort((a, b) => a.order - b.order)) {
    const groupName = item.group_name.trim() || "Ungrouped";
    groups.set(groupName, [...(groups.get(groupName) ?? []), item]);
  }

  return Array.from(groups.entries()).map(([name, groupItems]) => ({
    name,
    items: groupItems
  }));
}
