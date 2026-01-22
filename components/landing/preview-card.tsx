import Image from "next/image";

import { Card } from "@/components/ui/card";

export function PreviewCard() {
  return (
    <Card className="relative overflow-hidden p-4 transition hover:border-primary/40 hover:shadow-lg">
      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        <Image
          src="/Luma-project.gif"
          alt="LUMA demo in action"
          width={1280}
          height={720}
          priority
          unoptimized
          sizes="(min-width: 1024px) 520px, 100vw"
          className="h-full w-full object-cover"
        />
      </div>
    </Card>
  );
}
