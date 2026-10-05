import type { Metadata } from 'next';
import { getBrandIdentity } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Nosotros',
};

/**
 * Marcador de posicion. TODO nosotros: la historia de la marca se define en un
 * modulo posterior. El nombre sale de la identidad de marca, nunca a mano.
 */
export default async function AboutPage() {
  const brand = await getBrandIdentity();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1>Sobre {brand.name}</h1>
      <p className="text-muted">
        La historia de la marca está pendiente de definición. Este contenido
        llega en un módulo posterior.
      </p>
    </div>
  );
}