/** esbuild `binary` loader: a `.ttf` import is its bytes (esbuild.config.mjs). */
declare module '*.ttf' {
  const bytes: Uint8Array;
  export default bytes;
}
