"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setIsVisible(window.scrollY > 320);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function handleClick() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "fixed bottom-6 right-6 z-40 size-11 rounded-full border-border bg-card p-0 shadow-lg transition-all hover:bg-accent",
        isVisible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0"
      )}
      onClick={handleClick}
      aria-label="Scroll to top"
    >
      <ArrowUp className="size-5" aria-hidden="true" />
    </Button>
  );
}
