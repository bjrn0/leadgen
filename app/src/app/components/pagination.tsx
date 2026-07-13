"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Real pagination — replaces the decorative Prev/1 2 3/Next blocks. Renders
 * nothing when there's a single page. Numbered badges are clickable; a small
 * window of pages is shown around the current one.
 */
export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  const windowStart = Math.max(1, Math.min(page - 1, pageCount - 2));
  const pages = Array.from({ length: Math.min(3, pageCount) }, (_, i) => windowStart + i).filter(
    (p) => p <= pageCount,
  );

  return (
    <div className="flex items-center justify-between border-t pt-4">
      <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="h-4 w-4" />
        Prev
      </Button>
      <div className="flex items-center gap-1">
        {pages[0] > 1 ? <span className="px-1 text-xs text-muted-foreground">…</span> : null}
        {pages.map((p) => (
          <button key={p} type="button" onClick={() => onChange(p)} aria-label={`Page ${p}`} aria-current={p === page ? "page" : undefined}>
            <Badge variant={p === page ? "brand" : "outline"} className="cursor-pointer">
              {p}
            </Badge>
          </button>
        ))}
        {pages[pages.length - 1] < pageCount ? (
          <span className="px-1 text-xs text-muted-foreground">…</span>
        ) : null}
      </div>
      <Button size="sm" variant="outline" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
