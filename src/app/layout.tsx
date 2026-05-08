import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'US Stock Tracker',
  description: 'US stock watchlist, technical signals, and DCA portfolio tracker',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
