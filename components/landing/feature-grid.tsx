import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/section-title";

const highlights = [
  {
    title: "Instant scoring",
    description:
      "Improve pronunciation, fluency, and coherence with an always-on AI speaking coach.",
  },
  {
    title: "Personalized journeys",
    description:
      "Realistic scenarios and rubrics aligned with University and professional needs.",
  },
  {
    title: "Reports ready to share",
    description:
      "Integrated tools to generate clear reports for learners and teachers in seconds.",
  },
];

export function FeatureGrid() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <SectionTitle>Highlights</SectionTitle>
        <p className="text-2xl font-semibold text-foreground">
          Everything you need to run better speaking assessments.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {highlights.map((item) => (
          <Card
            key={item.title}
            className="h-full p-5 transition hover:border-primary/40 hover:bg-background/60"
          >
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed">
              {item.description}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
