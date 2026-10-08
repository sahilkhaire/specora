/** Swagger Petstore, bundled in public/fixtures so first-time users can try the app in one click. */
export function sampleSpecUrl(): string {
  return new URL(`${import.meta.env.BASE_URL}fixtures/petstore.swagger.json`, window.location.href).href;
}
