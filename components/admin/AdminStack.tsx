import type { ReactNode } from "react";

type AdminStackProps = {
  children: ReactNode;
};

export function AdminStack({ children }: AdminStackProps) {
  return <div className="space-y-8 md:space-y-10">{children}</div>;
}
