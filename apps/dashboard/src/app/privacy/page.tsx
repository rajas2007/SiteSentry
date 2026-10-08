'use client';

import { LegalPlaceholderPage } from "../../components/sentry/LegalPlaceholderPage";

export default function PrivacyPage() {
  return (
    <LegalPlaceholderPage
      section="01 / Legal"
      heading="Privacy Notice Status"
      message="Site Sentry is currently a functional preview. A comprehensive, legally binding Privacy Notice has not been established."
      guidance="Because this is a security tool, its architecture and data practices are intended to be documented strictly. We do not invent privacy claims or post template legal agreements that do not reflect the actual implementation."
    />
  );
}
