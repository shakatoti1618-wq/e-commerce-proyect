import Link from 'next/link';
import type { BrandIdentity } from '@/lib/brand';
import {
  collectSocialLinks,
  navigationLinks,
  socialNetworkLabels,
} from '@/lib/navigation';

interface FooterProps {
  brand: BrandIdentity;
}

/**
 * Pie de pagina: un unico <nav> para los enlaces del sitio y, aparte, una lista
 * de redes sociales. Las redes no son navegacion del sitio, asi que van en una
 * <ul> con su propia etiqueta y no en un segundo <nav>.
 *
 * Solo se pintan las redes que la marca tenga configuradas: con el fixture
 * actual no hay ninguna y la lista queda vacia.
 */
export default function Footer({ brand }: FooterProps) {
  const socialLinks = collectSocialLinks(brand.social);

  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:flex-row md:items-start md:justify-between">
        <nav aria-label="Enlaces del pie de página">
          <ul className="flex flex-col gap-2">
            {navigationLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-muted hover:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {socialLinks.length > 0 && (
          <ul aria-label="Redes sociales" className="flex flex-col gap-2">
            {socialLinks.map(({ network, href }) => (
              <li key={network}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${socialNetworkLabels[network]} (se abre en una pestaña nueva)`}
                  className="text-muted hover:text-foreground"
                >
                  {socialNetworkLabels[network]}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </footer>
  );
}