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

export interface SpecSummary {
  title: string;
  version: string;
  endpointCount: number;
  tags: string[];
}
