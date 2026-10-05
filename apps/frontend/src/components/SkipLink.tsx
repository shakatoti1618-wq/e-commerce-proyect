/**
 * Enlace de salto: primero en el DOM y visible solo al recibir foco, para que
 * quien navega con teclado no tenga que recorrer la navegacion en cada pagina.
 * El destino `#contenido-principal` es el <main> de layout.tsx, que es
 * focusable con tabIndex={-1}.
 */
export default function SkipLink() {
  return (
    <a
      href="#contenido-principal"
      className="sr-only bg-primary text-background focus:not-sr-only focus:outline-2 focus:outline-border-strong"
    >
      Saltar al contenido
    </a>
  );
}
