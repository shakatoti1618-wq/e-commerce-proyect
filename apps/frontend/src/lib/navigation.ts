import type { BrandIdentity } from '@/lib/brand';

/** Un enlace de navegacion del sitio. */
export interface NavigationLink {
  href: string;
  label: string;
}

/**
 * TODO navegacion: los destinos y sus ordenes son PROVISIONALES. La fuente
 * unica son estos datos: header, menu movil y pie los consumen desde aqui, de
 * modo que anadir una pagina nueva no obliga a tocar JSX.
 *
 * Las rutas /productos, /nosotros y /contacto llegan en un modulo posterior.
 */
export const navigationLinks: readonly NavigationLink[] = [
  { href: '/', label: 'Inicio' },
  { href: '/productos', label: 'Productos' },
  { href: '/nosotros', label: 'Nosotros' },
  { href: '/contacto', label: 'Contacto' },
];

/** Redes sociales admitidas por la marca. */
export type SocialNetwork = keyof BrandIdentity['social'];

/**
 * Etiquetas visibles de las redes. Las claves deben coincidir exactamente con
 * `BrandIdentity['social']`, asi el tipado obliga a anadir aqui toda red nueva
 * que acepte la marca.
 */
export const socialNetworkLabels: Record<SocialNetwork, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

/** Red social con URL resuelta, lista para pintar. */
export interface SocialLink {
  network: SocialNetwork;
  href: string;
}

/**
 * Descarta las redes ausentes y las que llegan vacias o con espacios, para que
 * el pie de pagina solo muestre enlaces reales. El tipo del esquema ya es
 * opcional: esto es la segunda barrera, por si el dato llega sin limpiar.
 */
export function collectSocialLinks(social: BrandIdentity['social']): readonly SocialLink[] {
  return (Object.keys(socialNetworkLabels) as SocialNetwork[])
    .map((network) => ({ network, href: social[network]?.trim() ?? '' }))
    .filter((link) => link.href.length > 0);
}
