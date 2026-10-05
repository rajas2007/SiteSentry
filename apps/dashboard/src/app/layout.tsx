import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SiteSentry | AI Web Security & Privacy Intelligence Dashboard',
  description: 'Enterprise-grade cybersecurity intelligence dashboard for real-time web threat interception, OSINT consensus, and privacy analysis.',
  keywords: ['cybersecurity', 'phishing protection', 'threat intelligence', 'privacy analysis', 'OSINT', 'SiteSentry'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
