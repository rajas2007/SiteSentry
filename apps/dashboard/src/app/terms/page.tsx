'use client';

import { LegalPlaceholderPage } from "../../components/sentry/LegalPlaceholderPage";

export default function TermsPage() {
  return (
    <LegalPlaceholderPage
      section="02 / Legal"
      heading="Terms of Service Status"
      message="Site Sentry is currently a functional preview. Comprehensive, legally binding Terms of Service have not been established."
      guidance="We do not invent claims or post template legal agreements that do not reflect the actual implementation. When Site Sentry is released beyond this preview, this page will be updated with real Terms of Service."
    />
  );
}
