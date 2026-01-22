import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/section-title";

const steps = [
  {
    title: "1. Start the test",
    copy: "Log into LUMA, choose the level, and start speaking right away.",
  },
  {
    title: "2. Get smart feedback",
    copy: "Real-time analysis on vocabulary, grammar, and pronunciation with practical tips.",
  },
  {
    title: "3. Share the reports",
    copy: "Send results to learners or download their speaking reports instantly.",
  },
];

export function StepsGrid() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <SectionTitle>How it works</SectionTitle>
        <p className="text-2xl font-semibold text-foreground">
          A simple flow for candidates, teachers, and admins.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((step) => (
          <Card
            key={step.title}
            className="h-full p-5 transition hover:border-primary/40 hover:bg-background/60"
          >
            <CardHeader>
              <CardTitle className="text-base">{step.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed">
              {step.copy}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
