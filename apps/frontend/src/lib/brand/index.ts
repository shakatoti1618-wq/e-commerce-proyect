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
const optionalSocialUrl = httpsUrl.optional().catch(undefined);

/**
 * Logo: ruta relativa local segura o URL https valida.
 *
 * Una ruta relativa solo es aceptable si, al resolverla el navegador, sigue
 * sirviendo el mismo origen. Se rechazan de forma explicita:
 *   - las rutas protocol-relative ("//evil.com/x"): el navegador las trata
 *     como URL absoluta;
 *   - cualquier barra invertida o barra al inicio;
 *   - tabulacion, salto de linea, retorno de carro, espacio y CUALQUIER otro
 *     caracter de control: el navegador los elimina al parsear la URL, asi
 *     que "/\t/evil.com/x" se convertia en "//evil.com/x" y terminaba
 *     sirviendo otro dominio;
 *   - y, como comprobacion de respaldo, la ruta se resuelve con
 *     `new URL()` contra un origen base y el origen resultante debe seguir
 *     siendo ese mismo origen.
 */
const logoSource = z
  .string()
  .min(1)
  .refine((value) => isSafeLocalPath(value) || isSafeHttpsUrl(value), {
    message: 'El logo debe ser una ruta relativa local segura o una URL https',
  });

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f\s\\]/;

function isSafeLocalPath(value: string): boolean {
  if (!value.startsWith('/')) return false;
  const second = value[1];
  if (second === '/' || second === '\\') return false;
  if (CONTROL_CHARACTERS.test(value)) return false;
  return resolvesToSameOrigin(value);
}

function isSafeHttpsUrl(value: string): boolean {
  return httpsUrl.safeParse(value).success;
}

function resolvesToSameOrigin(value: string): boolean {
  const base = 'https://placeholder.invalid';
  try {
    return new URL(value, base).origin === base;
  } catch {
    return false;
  }
}

export const brandSchema = z.object({
  name: z.string().min(1).max(60),
  tagline: z.string().max(160),
  logo: logoSource,
  social: z
    .object({
      instagram: optionalSocialUrl,
      facebook: optionalSocialUrl,
      tiktok: optionalSocialUrl,
    })
    .default({}),
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
      next: { revalidate: 3600 },
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
