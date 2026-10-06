import Image from 'next/image';
import Link from 'next/link';
import type { BrandIdentity } from '@/lib/brand';

interface LogoProps {
  brand: BrandIdentity;
}

/**
 * Logo de la marca como enlace a la home. Sin logica de cliente ni gestion de
 * errores: si el logo no existe, la alternativa textual es el nombre de la
 * marca y el enlace sigue siendo navegable.
 */
export default function Logo({ brand }: LogoProps) {
  return (
    <Link href="/" className="flex items-center gap-3">
      <Image src={brand.logo} alt="" width={64} height={64} unoptimized className="h-10 w-10" />
      <span className="text-lg font-semibold">{brand.name}</span>
    </Link>
  );
}
