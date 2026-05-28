import SwaggerParser from "@apidevtools/swagger-parser";
import YAML from "yaml";
import { detectSpecVersion } from "./detect-spec-version.js";
import type { ParseSpecOptions, ParseSpecResult } from "../types/spec-types.js";

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

    const version = detectSpecVersion(loaded);
    return {
      ok: true,
      spec: normalizeSpec(loaded),
      version,
      warnings: []
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
