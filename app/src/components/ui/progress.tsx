import * as React from "react";

import { cn } from "@/lib/utils";

export function Progress({
  className,
  value = 0,
  ...props
}: React.ComponentProps<"div"> & { value?: number }) {
  const boundedValue = Math.max(0, Math.min(100, value));

  return (
    <div
      data-slot="progress"
      className={cn("bg-secondary h-2 w-full overflow-hidden rounded-md", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={boundedValue}
      {...props}
    >
      <div
        className="h-full bg-[var(--brand)] transition-all"
        style={{ width: `${boundedValue}%` }}
      />
    </div>
  );
}
