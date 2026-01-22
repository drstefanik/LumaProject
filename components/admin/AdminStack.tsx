import { ReactNode } from "react";

type AdminStackProps = {
  children: ReactNode;
};

export function AdminStack({ children }: AdminStackProps) {
  return <div className="space-y-6">{children}</div>;
}
