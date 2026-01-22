import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '3PL Finder - Warehouse Marketplace',
  description: 'Search warehouses and 3PL providers with map-first discovery.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}
