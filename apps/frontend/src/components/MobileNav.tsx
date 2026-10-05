'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { navigationLinks } from '@/lib/navigation';

/**
 * Navegacion en pantallas estrechas: un boton que despliega un panel, no un
 * menu de aplicacion. El patron disclosure (aria-expanded + aria-controls) es
 * el correcto para una lista de enlaces de navegacion: no hay roles de menu ni
 * menuitem porque el contenido no es un menu de comandos.
 *
 * El panel se renderiza siempre y se oculta con `hidden`, de modo que
 * `aria-controls` siempre apunta a un elemento real.
 */
export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape' || !open) return;
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <div className="md:hidden" onKeyDown={handleKeyDown}>
      <button
        type="button"
        ref={buttonRef}
        aria-expanded={open}
        aria-controls="menu-movil"
        onClick={() => setOpen((previous) => !previous)}
        className="rounded border border-border-strong px-3 py-2 text-foreground"
      >
        {open ? 'Cerrar menú' : 'Menú'}
      </button>

      <ul
        id="menu-movil"
        hidden={!open}
        className="mt-4 flex flex-col gap-2 border-t border-border pt-4"
      >
        {navigationLinks.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              onClick={() => setOpen(false)}
              className="block py-2 text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}