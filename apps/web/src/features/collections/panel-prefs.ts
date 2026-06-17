import { readScopedItem, writeScopedItem } from "@/data/scoped-storage";

const SCHEMA_PANEL_KEY = "panel:schema";
const HISTORY_PANEL_KEY = "panel:history";

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = readScopedItem(key);
    if (raw === null) return fallback;
    return raw === "true";
  } catch {
    return fallback;
  }
}

function writeBool(key: string, value: boolean): void {
  writeScopedItem(key, String(value));
}

export function readSchemaPanelOpen(): boolean {
  return readBool(SCHEMA_PANEL_KEY, true);
}

export function writeSchemaPanelOpen(open: boolean): void {
  writeBool(SCHEMA_PANEL_KEY, open);
}

export function readHistoryPanelOpen(): boolean {
  return readBool(HISTORY_PANEL_KEY, false);
}

export function writeHistoryPanelOpen(open: boolean): void {
  writeBool(HISTORY_PANEL_KEY, open);
}
