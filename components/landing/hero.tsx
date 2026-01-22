import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="space-y-6">
      <Badge>
        <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
        LUMA - Language Understanding Mastery Assistant
      </Badge>

      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          LUMA, your speaking coach that is fast, clear, and brilliant.
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Train with dynamic simulations, receive instant feedback, and share
          reports ready for learners and teachers. Zero stress, just visible
          results.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Link
          href="/luma"
          className={buttonClasses({
            size: "lg",
            className: "w-full sm:w-auto",
          })}
        >
          Start the speaking test
        </Link>
        <p className="text-sm text-muted-foreground">
          No setup. You just need a microphone and 10 minutes.
        </p>
      </div>
    </section>
  );
}
