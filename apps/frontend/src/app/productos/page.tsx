import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Productos',
};

/**
 * Marcador de posicion. TODO productos: el catalogo real (listado, filtros y
 * ficha) llega en un modulo posterior; aqui no hay todavia logica de negocio.
 */
export default function ProductsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1>Productos</h1>
      <p className="text-muted">
        El catálogo de productos llega en un módulo posterior.
      </p>
    </div>
  );
}