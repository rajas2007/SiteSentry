'use client';
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PublicSiteLayout } from "./PublicSiteLayout";

export function LegalPlaceholderPage({
  section,
  heading,
  message,
  guidance,
}: {
  section: string;
  heading: string;
  message: string;
  guidance: string;
}) {
  return (
    <PublicSiteLayout>
      <article className="mx-auto min-h-[55vh] max-w-[960px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <p className="label-tech">Site Sentry · {section} · publication status</p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-heading sm:text-5xl">
          {heading}
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-foreground">{message}</p>

        <div className="mt-8 max-w-2xl border-l-2 border-caution/70 bg-caution-soft/35 px-4 py-4">
          <p className="label-tech text-caution">Current status</p>
          <p className="mt-2 text-sm font-semibold text-heading">Not yet published</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{guidance}</p>
        </div>

        <Link
          href="/"
          className="mt-8 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-analysis hover:text-heading"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Site Sentry
        </Link>
      </article>
    </PublicSiteLayout>
  );
}
