import SwaggerParser from "@apidevtools/swagger-parser";
import YAML from "yaml";

export type SpecSourceType = "url" | "text" | "file";

export interface ParseSpecOptions {
  sourceType: SpecSourceType;
  value: string;
}

export interface ParseSpecSuccess {
  ok: true;
  spec: Record<string, unknown>;
}

export interface ParseSpecFailure {
  ok: false;
  error: {
    message: string;
    hint?: string;
  };
}

export type ParseSpecResult = ParseSpecSuccess | ParseSpecFailure;

function parseTextInput(value: string): Record<string, unknown> {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Spec content is empty.");
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed) as Record<string, unknown>;
  }

  return YAML.parse(trimmed) as Record<string, unknown>;
}

function normalizeSpec(spec: Record<string, unknown>): Record<string, unknown> {
  return spec;
}

function getValidationHint(errorMessage: string): string {
  if (/Unexpected token|JSON/.test(errorMessage)) {
    return "Check JSON syntax and ensure there are no trailing commas.";
  }

  if (/YAML|indent/i.test(errorMessage)) {
    return "Check YAML indentation and ensure tabs are not used for indentation.";
  }

  if (/openapi|swagger/i.test(errorMessage)) {
    return "Ensure the root contains a valid OpenAPI version field.";
  }

  return "Review the spec structure and verify required OpenAPI fields are present.";
}

export async function parseAndValidateSpec(options: ParseSpecOptions): Promise<ParseSpecResult> {
  try {
    let loaded: Record<string, unknown>;

    if (options.sourceType === "url") {
      const bundled = (await SwaggerParser.bundle(options.value)) as Record<string, unknown>;
      loaded = bundled;
    } else {
      loaded = parseTextInput(options.value);
      await SwaggerParser.validate(loaded as any);
    }

    return {
      ok: true,
      spec: normalizeSpec(loaded)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parsing error";
    return {
      ok: false,
      error: {
        message,
        hint: getValidationHint(message)
      }
    };
  }
}

export function summarizeSpec(spec: Record<string, unknown>): {
  title: string;
  version: string;
  endpointCount: number;
  tags: string[];
} {
  const info = (spec.info as Record<string, unknown> | undefined) ?? {};
  const paths = (spec.paths as Record<string, unknown> | undefined) ?? {};

  const tags = new Set<string>();
  Object.values(paths).forEach((pathItem) => {
    if (pathItem && typeof pathItem === "object") {
      Object.values(pathItem as Record<string, unknown>).forEach((operation) => {
        const tagList = (operation as { tags?: unknown[] })?.tags;
        if (Array.isArray(tagList)) {
          tagList.forEach((tag) => {
            if (typeof tag === "string") {
              tags.add(tag);
            }
          });
        }
      });
    }
  });

  return {
    title: String(info.title ?? "Untitled API"),
    version: String(info.version ?? "unknown"),
    endpointCount: Object.keys(paths).length,
    tags: Array.from(tags).sort()
  };
}
