import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export function PublicNavbar() {
  return (
    <header className="border-b border-border bg-card">
      <Container className="flex items-center justify-between py-4">
        <Link href="/" className="text-lg font-semibold text-foreground">
          LUMA
        </Link>
        <Link
          href="/luma"
          className={buttonClasses({
            variant: "outline",
            className: "hidden sm:inline-flex",
          })}
        >
          Start the test
        </Link>
      </Container>
    </header>
  );
}
