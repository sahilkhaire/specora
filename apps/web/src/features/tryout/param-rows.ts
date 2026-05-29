import { mergeParamRecord } from "./tryout-utils";

export interface ParamRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export function newParamRow(
  partial?: Partial<Pick<ParamRow, "id" | "key" | "value" | "enabled">>
): ParamRow {
  return {
    id: partial?.id ?? `p_${crypto.randomUUID().slice(0, 8)}`,
    key: partial?.key ?? "",
    value: partial?.value ?? "",
    enabled: partial?.enabled ?? true
  };
}

export function recordToParamRows(record: Record<string, string>): ParamRow[] {
  const rows = Object.entries(record).map(([key, value]) =>
    newParamRow({ key, value, enabled: true })
  );
  return rows.length > 0 ? rows : [newParamRow()];
}

export function parseParamRowsInput(value: string): ParamRow[] {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "{}") {
    return [newParamRow()];
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;

    if (Array.isArray(parsed)) {
      const rows = parsed.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return newParamRow();
        }
        const row = item as Record<string, unknown>;
        return newParamRow({
          id: typeof row.id === "string" ? row.id : undefined,
          key: String(row.key ?? ""),
          value: String(row.value ?? ""),
          enabled: row.enabled !== false
        });
      });
      return rows.length > 0 ? rows : [newParamRow()];
    }

    if (parsed && typeof parsed === "object") {
      return recordToParamRows(
        Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>).map(([key, val]) => [key, String(val)])
        )
      );
    }
  } catch {
    /* fall through */
  }

  return [newParamRow()];
}

export function serializeParamRows(rows: ParamRow[]): string {
  const normalized = rows.length > 0 ? rows : [newParamRow()];
  return JSON.stringify(
    normalized.map(({ id, key, value, enabled }) => ({ id, key, value, enabled })),
    null,
    2
  );
}

export interface ParamRowsToRecordOptions {
  /** When false, include every row with a key (path params). Default true for query params. */
  respectEnabled?: boolean;
}

export function paramRowsToRecord(
  rows: ParamRow[],
  options: ParamRowsToRecordOptions = {}
): Record<string, string> {
  const respectEnabled = options.respectEnabled ?? true;
  const out: Record<string, string> = {};
  for (const row of rows) {
    if (respectEnabled && !row.enabled) continue;
    const key = row.key.trim();
    if (!key) continue;
    out[key] = row.value;
  }
  return out;
}

function rowIdForKey(key: string, currentRows: ParamRow[], usedIds: Set<string>): string {
  const match = currentRows.find((row) => row.key.trim() === key && !usedIds.has(row.id));
  if (match) {
    usedIds.add(match.id);
    return match.id;
  }
  const id = newParamRow().id;
  usedIds.add(id);
  return id;
}

export function mergeParamRowsInput(value: string, scaffold: Record<string, string>): ParamRow[] {
  const currentRows = parseParamRowsInput(value);
  const enabledByKey = new Map<string, boolean>();
  const usedIds = new Set<string>();

  for (const row of currentRows) {
    const key = row.key.trim();
    if (key) {
      enabledByKey.set(key, row.enabled);
    }
  }

  const merged = mergeParamRecord(paramRowsToRecord(currentRows), scaffold);
  const schemaKeys = Object.keys(scaffold);
  const extraKeys = Object.keys(merged).filter((key) => !schemaKeys.includes(key));

  const rows: ParamRow[] = [
    ...schemaKeys.map((key) =>
      newParamRow({
        id: rowIdForKey(key, currentRows, usedIds),
        key,
        value: merged[key] ?? "",
        enabled: enabledByKey.has(key) ? enabledByKey.get(key)! : true
      })
    ),
    ...extraKeys.map((key) =>
      newParamRow({
        id: rowIdForKey(key, currentRows, usedIds),
        key,
        value: merged[key] ?? "",
        enabled: enabledByKey.has(key) ? enabledByKey.get(key)! : true
      })
    )
  ];

  for (const row of currentRows) {
    if (!row.key.trim() && !usedIds.has(row.id)) {
      rows.push({ ...row });
      usedIds.add(row.id);
    }
  }

  return rows.length > 0 ? rows : [newParamRow()];
}

export function parseParamRowsToRecord(
  value: string,
  scaffold?: Record<string, string>,
  options: ParamRowsToRecordOptions = {}
): Record<string, string> {
  const rows = scaffold ? mergeParamRowsInput(value, scaffold) : parseParamRowsInput(value);
  return paramRowsToRecord(rows, options);
}

export function serializeParamRecord(record: Record<string, string>): string {
  return serializeParamRows(recordToParamRows(record));
}
