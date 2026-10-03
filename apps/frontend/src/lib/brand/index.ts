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

/** Redes sociales: solo https. */
const socialUrl = httpsUrl;

/** Logo: admite ruta relativa local (empieza por /) o URL https. */
const logoSource = z
  .string()
  .min(1)
  .refine(
    (value) => value.startsWith('/') || value.startsWith('https://'),
    { message: 'El logo debe ser una ruta relativa o una URL https' },
  );

export const brandSchema = z.object({
  name: z.string().min(1),
  tagline: z.string(),
  logo: logoSource,
  social: z.object({
    instagram: socialUrl,
    facebook: socialUrl,
    tiktok: socialUrl,
  }),
});

export type BrandIdentity = z.infer<typeof brandSchema>;

/**
 * Fixture provisional. TODO marca: sustituir por datos reales de la marca.
 */
export const localBrandFixture: BrandIdentity = {
  name: 'Lume',
  tagline: 'TODO: eslogan definitivo de la marca',
  logo: '/logo.svg',
  social: {
    instagram: 'https://instagram.com/todo',
    facebook: 'https://facebook.com/todo',
    tiktok: 'https://tiktok.com/todo',
  },
};

const SETTINGS_PATH = '/api/settings';
const REQUEST_TIMEOUT_MS = 2000;

async function fetchBrandFromApi(): Promise<BrandIdentity | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${SETTINGS_PATH}`, {
      signal: controller.signal,
    });

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