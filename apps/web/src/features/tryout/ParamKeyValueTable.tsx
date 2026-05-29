import { useEffect, useMemo, useRef, useState } from "react";
import {
  mergeParamRowsInput,
  newParamRow,
  parseParamRowsInput,
  serializeParamRows,
  type ParamRow
} from "./param-rows";

import { VariableHighlightInput } from "./VariableHighlight";

interface ParamKeyValueTableProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  schemaParams?: Record<string, string>;
  /** Query params only — path params are always included. */
  enableToggle?: boolean;
  variables?: Record<string, string>;
}

function deriveRows(
  value: string,
  schemaParams: Record<string, string> | undefined,
  enableToggle: boolean
): ParamRow[] {
  const rowOptions = { defaultEnabled: enableToggle ? false : true };
  const base =
    schemaParams && Object.keys(schemaParams).length > 0
      ? mergeParamRowsInput(value, schemaParams, rowOptions)
      : parseParamRowsInput(value, rowOptions);
  if (!enableToggle) {
    return base.map((row) => ({ ...row, enabled: true }));
  }
  return base;
}

export function ParamKeyValueTable({
  label,
  value,
  onChange,
  schemaParams,
  enableToggle = true,
  variables = {}
}: ParamKeyValueTableProps) {
  const schemaKey = useMemo(() => JSON.stringify(schemaParams ?? {}), [schemaParams]);
  const [rows, setRows] = useState(() => deriveRows(value, schemaParams, enableToggle));
  const lastExternalValue = useRef(value);
  const lastSchemaKey = useRef(schemaKey);

  useEffect(() => {
    const externalChanged = value !== lastExternalValue.current;
    const schemaChanged = schemaKey !== lastSchemaKey.current;
    if (!externalChanged && !schemaChanged) return;

    lastExternalValue.current = value;
    lastSchemaKey.current = schemaKey;
    setRows(deriveRows(value, schemaParams, enableToggle));
  }, [value, schemaParams, schemaKey, enableToggle]);

  function commit(next: ParamRow[]) {
    const normalized = enableToggle ? next : next.map((row) => ({ ...row, enabled: true }));
    const serialized = serializeParamRows(normalized);
    lastExternalValue.current = serialized;
    setRows(normalized);
    onChange(serialized);
  }

  function updateRow(id: string, patch: Partial<Pick<ParamRow, "key" | "value" | "enabled">>) {
    commit(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addRow() {
    commit([...rows, newParamRow()]);
  }

  function removeRow(id: string) {
    const next = rows.filter((row) => row.id !== id);
    commit(next.length > 0 ? next : [newParamRow()]);
  }

  return (
    <div className={`param-kv-table${enableToggle ? "" : " param-kv-table--no-toggle"}`}>
      <div className="param-kv-table-head">
        <span className="param-kv-table-label">{label}</span>
        <button type="button" className="tryout-ghost-btn" onClick={addRow}>
          + Add
        </button>
      </div>
      <div className="param-kv-table-wrap">
        <table>
          <thead>
            <tr>
              {enableToggle ? <th className="param-kv-col-enable" aria-label="Enabled" /> : null}
              <th>Key</th>
              <th>Value</th>
              <th className="param-kv-col-actions" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={enableToggle && !row.enabled ? "param-kv-row--disabled" : ""}>
                {enableToggle ? (
                  <td className="param-kv-col-enable">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(event) => updateRow(row.id, { enabled: event.target.checked })}
                      aria-label={`Enable ${row.key || "param"}`}
                    />
                  </td>
                ) : null}
                <td>
                  <input
                    className="param-kv-input"
                    value={row.key}
                    onChange={(event) => updateRow(row.id, { key: event.target.value })}
                    placeholder="key"
                    spellCheck={false}
                  />
                </td>
                <td>
                  <VariableHighlightInput
                    className="param-kv-input"
                    value={row.value}
                    onChange={(next) => updateRow(row.id, { value: next })}
                    variables={variables}
                    placeholder="value"
                    spellCheck={false}
                  />
                </td>
                <td className="param-kv-col-actions">
                  <button
                    type="button"
                    className="param-kv-remove-btn"
                    onClick={() => removeRow(row.id)}
                    aria-label="Remove row"
                    title="Remove"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
