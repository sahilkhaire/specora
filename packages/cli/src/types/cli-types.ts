import type { ParseSpecResult, SpecSummary } from "@specora/core";

export type OutputFormat = "text" | "json";

export interface ParsedSpecFile {
  result: ParseSpecResult;
  text: string;
}

export interface PreviewPayload {
  summary: SpecSummary;
  spec: Record<string, unknown>;
}
