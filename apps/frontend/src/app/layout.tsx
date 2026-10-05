import type { Metadata } from 'next';
import { fontBrand } from '@/lib/fonts';
import { getBrandIdentity } from '@/lib/brand';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import SkipLink from '@/components/SkipLink';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrandIdentity();

  return {
    title: {
      default: brand.name,
      template: `%s | ${brand.name}`,
    },
    description: brand.tagline,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const brand = await getBrandIdentity();

  return (
    <html lang="es" className={fontBrand.variable}>
      <body className="flex min-h-screen flex-col bg-background text-foreground">
        <SkipLink />
        <Header brand={brand} />
        <main id="contenido-principal" tabIndex={-1} className="flex-1">
          {children}
        </main>
        <Footer brand={brand} />
      </body>
    </html>
  );
}