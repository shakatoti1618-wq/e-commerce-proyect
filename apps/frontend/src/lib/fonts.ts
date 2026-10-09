import { Outfit } from 'next/font/google';

/*
 * TODO marca: confirmar la tipografia definitiva. Outfit es una sans-serif
 * geometrica provisional (variable, subconjunto latin). La eleccion final de
 * fuente la decide la marca.
 *
 * next/font exige valores estaticos en tiempo de build: por eso la fuente es
 * una constante aqui y NO una variable de entorno. La clase `font-brand` que
 * exponemos es la que se aplica en <html> desde layout.tsx, y cuyo valor
 * consume globals.css mediante var(--font-brand).
 */
export const fontBrand = Outfit({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-brand',
});
