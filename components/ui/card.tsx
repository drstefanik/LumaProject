import type { HTMLAttributes } from "react";

const baseClasses =
  "rounded-xl border border-border bg-card text-foreground shadow-sm";

type CardProps = HTMLAttributes<HTMLDivElement>;

type CardSectionProps = HTMLAttributes<HTMLDivElement>;

type CardTitleProps = HTMLAttributes<HTMLHeadingElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div className={[baseClasses, className].filter(Boolean).join(" ")} {...props} />
  );
}

export function CardHeader({ className, ...props }: CardSectionProps) {
  return (
    <div
      className={["space-y-1", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: CardTitleProps) {
  return (
    <h3
      className={["text-lg font-semibold", className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: CardSectionProps) {
  return (
    <div
      className={["text-sm text-muted-foreground", className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
