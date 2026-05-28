import YAML from "yaml";
import SwaggerParser from "@apidevtools/swagger-parser";
import { detectSpecVersion, type DetectedSpecVersion } from "./detect-spec-version.js";

function processGoTemplate(input: string): string {
  let processed = input;
  const urlMatch = input.match(/https?:\/\/([^/\s"]+)/);
  const domain = urlMatch ? urlMatch[1] : "api.example.com";
  const hostName = domain.split(".")[0] ?? "api";
  const apiTitle = hostName.charAt(0).toUpperCase() + hostName.slice(1) + " API";

  processed = processed.replace(/\{\{\s*marshal\s+\.Schemes\s*\}\}/g, '["https"]');
  processed = processed.replace(/\{\{\s*marshal\s+\.\w+\s*\}\}/g, "[]");
  processed = processed.replace(/"(\{\{[^}]+\}\})"/g, (_match: string, inner: string) => {
    const fieldMatch = inner.match(/\.\s*(\w+)/);
    const field = fieldMatch ? fieldMatch[1].toLowerCase() : "";
    if (field === "title" || field === "name") return `"${apiTitle}"`;
    if (field === "host") return `"${domain}"`;
    if (field === "basepath") return '"/"';
    if (field === "version") return '"1.0.0"';
    if (field === "description") return '""';
    return '""';
  });
  processed = processed.replace(/\{\{[^}]*\}\}/g, "null");
  return processed;
}

function parseTextInput(value: string): Record<string, unknown> {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Spec input is empty.");
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed) as Record<string, unknown>;
  }

  return YAML.parse(trimmed) as Record<string, unknown>;
}

export type ParseSpecTextResult =
  | {
      ok: true;
      spec: Record<string, unknown>;
      version: DetectedSpecVersion;
      warnings: string[];
    }
  | {
      ok: false;
      error: string;
    };

export async function parseSpecTextAsync(input: string): Promise<ParseSpecTextResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "Spec input is empty." };
  }

  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    return {
      ok: false,
      error:
        "The response is HTML, not an OpenAPI spec. Ensure the URL points directly to the API spec file."
    };
  }

  let processedInput = trimmed;
  if (trimmed.includes("{{") && trimmed.includes("}}")) {
    processedInput = processGoTemplate(trimmed);
  }

  try {
    const parsed = parseTextInput(processedInput);
    if (!parsed.openapi && !parsed.swagger) {
      return {
        ok: false,
        error:
          "Missing openapi/swagger version field. The file doesn't appear to be a valid OpenAPI/Swagger specification."
      };
    }

    const warnings: string[] = [];
    const version = detectSpecVersion(parsed);

    try {
      await SwaggerParser.validate(parsed as unknown as Parameters<typeof SwaggerParser.validate>[0]);
    } catch (validationError) {
      const message =
        validationError instanceof Error ? validationError.message : "Validation failed";
      warnings.push(`Validation warning: ${message}`);
    }

    return { ok: true, spec: parsed, version, warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parse error";
    if (message.includes("JSON") || message.includes("position") || message.includes("Unexpected token")) {
      return {
        ok: false,
        error: `JSON parse error: ${message}. Ensure the content is valid JSON or YAML.`
      };
    }
    return { ok: false, error: `Parse error: ${message}` };
  }
}

/** Sync parse without swagger-parser validation (for fast UI paths). */
export function parseSpecTextSync(input: string): ParseSpecTextResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "Spec input is empty." };
  }

  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    return {
      ok: false,
      error:
        "The response is HTML, not an OpenAPI spec. Ensure the URL points directly to the API spec file."
    };
  }

  let processedInput = trimmed;
  if (trimmed.includes("{{") && trimmed.includes("}}")) {
    processedInput = processGoTemplate(trimmed);
  }

  try {
    const parsed = parseTextInput(processedInput);
    if (!parsed.openapi && !parsed.swagger) {
      return {
        ok: false,
        error:
          "Missing openapi/swagger version field. The file doesn't appear to be a valid OpenAPI/Swagger specification."
      };
    }

    return { ok: true, spec: parsed, version: detectSpecVersion(parsed), warnings: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parse error";
    return { ok: false, error: `Parse error: ${message}` };
  }
}
