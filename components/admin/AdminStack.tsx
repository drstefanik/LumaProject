import type { ReactNode } from "react";

type AdminStackProps = {
  children: ReactNode;
  gap?: "md" | "lg";
};

export function AdminStack({ children, gap = "lg" }: AdminStackProps) {
  const cls = gap === "md" ? "space-y-4 md:space-y-6" : "space-y-6 md:space-y-8";
  return <div className={cls}>{children}</div>;
}
