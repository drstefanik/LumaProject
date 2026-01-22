import type { HTMLAttributes } from "react";

const baseClasses =
  "inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground";

type BadgeProps = HTMLAttributes<HTMLSpanElement>;

export function Badge({ className, ...props }: BadgeProps) {
  return (
    <span
      className={[baseClasses, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
