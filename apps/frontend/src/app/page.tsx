import { getBrandIdentity } from '@/lib/brand';

export default async function HomePage() {
  const brand = await getBrandIdentity();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1>{brand.name}</h1>
      <p className="text-muted">{brand.tagline}</p>
      <p>TODO: catálogo de productos. Llega en un módulo posterior.</p>
    </div>
  );
}
