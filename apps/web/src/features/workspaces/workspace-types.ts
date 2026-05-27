/**
 * Workspace types for managing specs and environments
 */

export type SpecSource = 
  | { type: "url"; value: string }
  | { type: "text"; value: string }
  | { type: "file"; value: string; fileName: string };

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  /** Single source of truth for the OpenAPI spec */
  specSource: SpecSource | null;
  /** Parsed spec object (cached) */
  spec: Record<string, unknown> | null;
  /** Timestamp when workspace was created */
  createdAt: string;
  /** Timestamp when workspace was last updated */
  updatedAt: string;
}
