import type { Metadata } from 'next';
import { fontBrand } from '@/lib/fonts';
import { getBrandIdentity } from '@/lib/brand';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrandIdentity();

  return {
    title: brand.name,
    description: brand.tagline,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={fontBrand.variable}>
      <body>{children}</body>
    </html>
  );
}
