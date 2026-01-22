import { FeatureGrid } from "@/components/landing/feature-grid";
import { Hero } from "@/components/landing/hero";
import { PreviewCard } from "@/components/landing/preview-card";
import { PublicNavbar } from "@/components/landing/public-navbar";
import { StepsGrid } from "@/components/landing/steps-grid";
import { Container } from "@/components/ui/container";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNavbar />

      <main className="space-y-16 py-10 md:py-16">
        <Container className="space-y-12">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <Hero />
            <PreviewCard />
          </div>

          <FeatureGrid />
        </Container>

        <Container>
          <StepsGrid />
        </Container>
      </main>
    </div>
  );
}
