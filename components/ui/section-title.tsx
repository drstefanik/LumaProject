import type { HTMLAttributes } from "react";

const baseClasses = "text-sm font-semibold uppercase tracking-wide text-muted-foreground";

type SectionTitleProps = HTMLAttributes<HTMLHeadingElement>;

export function SectionTitle({ className, ...props }: SectionTitleProps) {
  return (
    <h2
      className={[baseClasses, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
