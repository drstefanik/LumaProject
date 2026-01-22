import type { InputHTMLAttributes } from "react";

const baseClasses =
  "mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={[baseClasses, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
