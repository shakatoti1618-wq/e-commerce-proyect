import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contacto',
};

/** TODO contacto: datos reales y formulario en un modulo posterior. */
export default function ContactPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1>Contacto</h1>
      <p className="text-muted">
        Los datos de contacto están pendientes de definir. Llegan en un módulo posterior.
      </p>
    </div>
  );
}
