import Link from 'next/link';
import type { BrandIdentity } from '@/lib/brand';
import { navigationLinks } from '@/lib/navigation';
import Logo from '@/components/Logo';
import MobileNav from '@/components/MobileNav';

interface HeaderProps {
  brand: BrandIdentity;
}

/**
 * Cabecera comun a todas las paginas: marca, navegacion principal en
 * pantallas anchas y menu desplegable en pantallas estrechas.
 *
 * Su <nav> se distingue del del pie de pagina por su aria-label, para que un
 * lector de pantalla pueda saltar de uno a otro.
 */
export default function Header({ brand }: HeaderProps) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <Logo brand={brand} />

          <nav aria-label="Navegación principal">
            <ul className="hidden items-center gap-6 md:flex">
              {navigationLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-foreground hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <MobileNav />
          </nav>
        </div>
      </div>
    </header>
  );
}
