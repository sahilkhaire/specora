type SwaggerParserModule = typeof import("@apidevtools/swagger-parser");

let loader: Promise<SwaggerParserModule> | null = null;

/**
 * Loaded on demand so browser bundles that only use the sync parser don't
 * ship swagger-parser and its ~270 kB of validators.
 */
async function swaggerParser(): Promise<SwaggerParserModule> {
  loader ??= import("@apidevtools/swagger-parser").then(
    (mod) => ((mod as unknown as { default?: SwaggerParserModule }).default ?? mod) as SwaggerParserModule
  );
  return loader;
}

/**
 * Validate without side effects. SwaggerParser.validate() dereferences its
 * argument in place, which turns recursive schemas into circular objects that
 * can no longer be serialised, so it only ever sees a copy.
 */
export async function validateSpec(spec: Record<string, unknown>): Promise<void> {
  const parser = await swaggerParser();
  await parser.validate(structuredClone(spec) as unknown as Parameters<SwaggerParserModule["validate"]>[0]);
}

export async function bundleSpec(pathOrUrl: string): Promise<Record<string, unknown>> {
  const parser = await swaggerParser();
  return (await parser.bundle(pathOrUrl)) as Record<string, unknown>;
}
