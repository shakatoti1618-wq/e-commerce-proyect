import { z } from 'zod';

/*
 * TODO marca: los valores del fixture son PROVISIONALES. Cuando exista el
 * endpoint /api/settings del backend (modulo M3/M4), esta identidad pasa a
 * venir de alli. El fixture solo cubre el caso de backend ausente o caido.
 */

/** URL absoluta: solo protocolo https. Rechaza http, javascript:, data:, ftp, etc. */
const httpsUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith('https://'), {
    message: 'La URL debe usar el protocolo https',
  });

/**
 * Redes sociales: opcionales y solo https. Una red vacia o invalida se
 * descarta sola con `.catch(undefined)` y NO invalida el resto de la marca:
 * el footer simplemente omite las que no existan.
 */
const optionalSocialUrl = httpsUrl
  .optional()
  .catch(undefined);

/**
 * Logo: ruta relativa local o URL https.
 *
 * Una ruta relativa valida empieza por "/" y su segundo caracter NO puede ser
 * "/" ni "\". Asi se rechazan las rutas protocol-relative como "//evil.com/x"
 * y "/\evil.com/x", que el navegador interpretaria como otro dominio.
 */
const logoSource = z
  .string()
  .min(1)
  .refine((value) => value.startsWith('https://') || isSafeRelativePath(value), {
    message: 'El logo debe ser una ruta relativa segura o una URL https',
  });

function isSafeRelativePath(value: string): boolean {
  if (!value.startsWith('/')) return false;
  const second = value[1];
  return second !== '/' && second !== '\\';
}

export const brandSchema = z.object({
  name: z.string().min(1).max(60),
  tagline: z.string().max(160),
  logo: logoSource,
  social: z.object({
    instagram: optionalSocialUrl,
    facebook: optionalSocialUrl,
    tiktok: optionalSocialUrl,
  }),
});

export type BrandIdentity = z.infer<typeof brandSchema>;

/**
 * Fixture provisional. TODO marca: sustituir por datos reales de la marca.
 *
 * No incluye redes sociales: son datos de negocio reales y no se inventan.
 * El footer omitira las que no existan.
 */
export const localBrandFixture: BrandIdentity = {
  name: 'Lume',
  tagline: 'TODO: eslogan definitivo de la marca',
  logo: '/logo.svg',
  social: {},
};

const SETTINGS_PATH = '/api/settings';
const REQUEST_TIMEOUT_MS = 2000;

/**
 * `next` no forma parte del `RequestInit` de lib.dom hasta que Next genera
 * `next-env.d.ts` (que aporta la amplificacion global de tipos). Se declara
 * aqui la opcion de cacheo para no depender de esa referencia generada.
 */
type NextFetchRequestInit = RequestInit & {
  next?: { revalidate: number };
};

async function fetchBrandFromApi(): Promise<BrandIdentity | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const requestInit: NextFetchRequestInit = {
      signal: controller.signal,
      next: { revalidate: 3600 },
    };

    const response = await fetch(`${baseUrl}${SETTINGS_PATH}`, requestInit);

    if (!response.ok) {
      return null;
    }

    const payload: unknown = await response.json();
    const parsed = brandSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Devuelve la identidad de marca. Si el backend no esta disponible, falla,
 * responde con error o devuelve algo que no valida el esquema, cae siempre al
 * fixture local: la tienda renderiza igual sin backend.
 */
export async function getBrandIdentity(): Promise<BrandIdentity> {
  const fromApi = await fetchBrandFromApi();
  return fromApi ?? localBrandFixture;
}
