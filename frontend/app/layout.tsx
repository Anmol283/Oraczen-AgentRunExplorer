import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Run Explorer',
  description: 'Explore agent runs and operational health',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
