import { getBrandIdentity } from '@/lib/brand';

export default async function HomePage() {
  const brand = await getBrandIdentity();

  return (
    <main className="bg-background text-foreground">
      <h1>{brand.name}</h1>
      <p className="text-muted">{brand.tagline}</p>
      <p>TODO: catalogo de productos. Llega en un modulo posterior.</p>
    </main>
  );
}
