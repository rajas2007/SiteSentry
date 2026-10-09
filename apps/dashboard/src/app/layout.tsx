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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}

