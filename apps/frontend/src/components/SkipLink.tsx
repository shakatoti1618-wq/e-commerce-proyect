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
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-background"
    >
      Saltar al contenido
    </a>
  );
}
