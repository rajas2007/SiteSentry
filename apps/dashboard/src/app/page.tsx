'use client';

import Link from "next/link";
import { ArrowRight, ShieldCheck, Eye, Radar, Globe } from "lucide-react";
import { cn } from "../lib/utils";
import { sampleAnalyses, type AnalysisResponse } from "../lib/sentry";
import {
  CredentialProtectionDemo,
} from "../components/sentry/MarketingDemos";
import { PublicSiteLayout } from "../components/sentry/PublicSiteLayout";
import { RiskBadge } from "../components/sentry/primitives";

const riskExamples = [sampleAnalyses[0]!, sampleAnalyses[1]!, sampleAnalyses[2]!];

const signalAreas = [
  {
    id: "security",
    number: "01",
    title: "Security",
    icon: ShieldCheck,
    description:
      "Look at page behavior that can put an account or device at risk: suspicious login forms, unencrypted connections, credential theft and malware indicators.",
  },
  {
    id: "privacy",
    number: "02",
    title: "Privacy",
    icon: Eye,
    description:
      "Surface privacy signals such as third-party trackers, missing policy links and forms that post information to another domain.",
  },
  {
    id: "threat-intel",
    number: "03",
    title: "Threat intelligence",
    icon: Radar,
    description:
      "Check the domain against reputation feeds and structural heuristics, helping to identify infrastructure known for hosting risk.",
  },
  {
    id: "explainability",
    number: "04",
    title: "A single explanation",
    icon: Globe,
    description:
      "Bring available signals together as a risk score, severity, confidence indication and recommendation-not just a bare allow-or-block label.",
  },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>;
}

export default function LandingPage() {
  return (
    <PublicSiteLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border/70">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-analysis/10 via-background to-background" />

        <div className="relative mx-auto flex min-h-[calc(100vh-68px)] max-w-[1360px] flex-col justify-center px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-tight text-heading sm:text-6xl lg:text-7xl">
              Know before you trust a website.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-xl">
              Site Sentry is designed to help protect people while they browse. It explains website
              security, privacy and threat-intelligence signals so you can make informed decisions.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/console"
                className="inline-flex min-h-12 items-center gap-2 border border-analysis/55 bg-analysis px-5 text-sm font-semibold text-background transition-colors hover:bg-analysis/90"
              >
                Open dashboard
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* The Challenge */}
      <section className="border-b border-border/70" aria-labelledby="challenge-title">
        <div className="mx-auto max-w-[1360px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <SectionLabel>The challenge</SectionLabel>
              <h2
                id="challenge-title"
                className="mt-4 text-3xl font-semibold tracking-tight text-heading sm:text-4xl lg:max-w-md lg:leading-[1.15]"
              >
                Security alerts without explanations are easy to ignore.
              </h2>
            </div>
            <div className="flex flex-col justify-center gap-6">
              <p className="text-base leading-relaxed text-foreground">
                When a browser warning appears without context, it often lacks the actionable
                details people expect to see. A simple yes-or-no warning can leave the most useful
                question unanswered: why is this page a risk?
              </p>
              <p className="text-base leading-relaxed text-muted-foreground">
                Site Sentry is designed to weigh more than whether a domain already appears on a
                blocklist. By looking at page behavior and privacy signals, it can help explain the
                assessment.
              </p>
              <p className="border-l-2 border-analysis/55 pl-4 text-base font-medium italic leading-relaxed text-heading">
                The aim is not a louder warning. It is a clearer reason to pause before sharing
                information.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Product Demos */}
      <section id="how-it-works" className="scroll-mt-24 border-b border-border/70">
        <div className="mx-auto max-w-[1360px] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div>
            <SectionLabel>01 / Signal analysis</SectionLabel>
            <h2 className="mt-4 max-w-lg text-3xl font-semibold tracking-tight text-heading sm:text-4xl">
              Bringing context to the surface.
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Site Sentry groups the available evidence into distinct areas, providing a more
              complete picture of a website&apos;s behavior.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-10 border-t border-border/60 pt-10 sm:grid-cols-2 lg:grid-cols-4 lg:pt-12">
            {signalAreas.map((area) => (
              <div key={area.id} className="group relative flex flex-col items-start">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded border border-border bg-secondary/50 text-analysis transition-colors group-hover:bg-secondary">
                  <area.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-heading">{area.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {area.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Decisions */}
      <section className="border-b border-border/70 bg-secondary/20" aria-labelledby="decisions-title">
        <div className="mx-auto max-w-[1360px] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-16">
            <div>
              <div className="sticky top-24">
                <SectionLabel>02 / Risk and decision</SectionLabel>
                <h2
                  id="decisions-title"
                  className="mt-4 text-3xl font-semibold tracking-tight text-heading sm:text-4xl"
                >
                  Turning signals into an actionable assessment.
                </h2>
                <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Instead of presenting a wall of technical data, the overall assessment brings the
                  available evidence together without hiding where it came from. Below are examples
                  using sample data.
                </p>
              </div>
            </div>
            <div className="flex flex-col rounded-md border border-border/60 bg-card shadow-sm sm:flex-row md:flex-col">
              {riskExamples.map((analysis, index) => (
                <RiskDecision key={analysis.hostname} analysis={analysis} index={index} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Interventions */}
      <section id="security" className="scroll-mt-24 border-b border-border/70" aria-labelledby="protection-title">
        <div className="mx-auto max-w-[1360px] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-end lg:gap-12">
            <div>
              <SectionLabel>03 / Active protection</SectionLabel>
              <h2
                id="protection-title"
                className="mt-4 max-w-lg text-3xl font-semibold tracking-tight text-heading sm:text-4xl"
              >
                When a login looks suspicious, the warning should be clear.
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              The credential-theft fixture demonstrates the intervention UI: a high-risk assessment,
              visible reasons, and a disabled sample password field. This page does not control a
              real tab or handle real credentials.
            </p>
          </div>
          <div className="mt-9">
            <CredentialProtectionDemo />
          </div>
        </div>
      </section>

      {/* Exploring */}
      <section className="border-b border-border/70" aria-labelledby="final-cta-title">
        <div className="mx-auto grid max-w-[1360px] gap-7 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-12 lg:px-8">
          <div>
            <SectionLabel>Explore Site Sentry</SectionLabel>
            <h2
              id="final-cta-title"
              className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-heading sm:text-4xl"
            >
              Browse with more context.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              See how a website&apos;s sample signals become a score, an explanation and a decision.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link
              href="/console"
              className="inline-flex min-h-11 items-center gap-2 border border-analysis/55 bg-analysis px-4 text-sm font-semibold text-background hover:bg-analysis/90"
            >
              Open Dashboard
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </PublicSiteLayout>
  );
}

function RiskDecision({ analysis, index }: { analysis: AnalysisResponse; index: number }) {
  return (
    <article
      className={cn(
        "min-w-0 border-b border-border/60 px-4 py-5 last:border-b-0 sm:px-5 md:border-b-0",
        index < 2 && "md:border-r",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RiskBadge severity={analysis.severity} />
        <span className="font-mono text-xs text-muted-foreground">{analysis.score} / 100</span>
      </div>
      <p className="mt-4 break-all font-mono text-xs text-muted-foreground">{analysis.hostname}</p>
      <p className="mt-2 text-base font-semibold leading-relaxed text-heading">
        {analysis.decision.message}
      </p>
    </article>
  );
}
