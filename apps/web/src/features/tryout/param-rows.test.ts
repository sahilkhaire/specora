import { describe, expect, it } from "vitest";
import {
  mergeParamRowsInput,
  parseParamRowsInput,
  parseParamRowsToRecord,
  paramRowsToRecord,
  recordToParamRows,
  serializeParamRecord,
  serializeParamRows
} from "./param-rows";

describe("param-rows", () => {
  it("converts records to rows and back", () => {
    const rows = recordToParamRows({ id: "42", name: "test" });
    expect(rows).toHaveLength(2);
    expect(paramRowsToRecord(rows)).toEqual({ id: "42", name: "test" });
  });

  it("skips disabled or empty keys", () => {
    const rows = parseParamRowsInput(
      serializeParamRows([
        { id: "1", key: "a", value: "1", enabled: true },
        { id: "2", key: "b", value: "2", enabled: false },
        { id: "3", key: "", value: "3", enabled: true },
        { id: "4", key: "  ", value: "4", enabled: true }
      ])
    );
    expect(paramRowsToRecord(rows)).toEqual({ a: "1" });
  });

  it("parses legacy object JSON", () => {
    const rows = parseParamRowsInput('{"userId":"123","active":"true"}');
    expect(paramRowsToRecord(rows)).toEqual({ userId: "123", active: "true" });
  });

  it("merges scaffold keys with saved values", () => {
    const rows = mergeParamRowsInput(
      serializeParamRows([{ id: "1", key: "userId", value: "99", enabled: true }]),
      { userId: "1", page: "0", limit: "20" }
    );
    expect(paramRowsToRecord(rows)).toEqual({ userId: "99", page: "0", limit: "20" });
  });

  it("parseParamRowsToRecord applies scaffold defaults", () => {
    const record = parseParamRowsToRecord("{}", { id: "123", active: "false" });
    expect(record).toEqual({ id: "123", active: "false" });
  });

  it("path params ignore disabled flag when respectEnabled is false", () => {
    const rows = parseParamRowsInput(
      serializeParamRows([{ id: "1", key: "userId", value: "42", enabled: false }])
    );
    expect(paramRowsToRecord(rows, { respectEnabled: false })).toEqual({ userId: "42" });
    expect(paramRowsToRecord(rows)).toEqual({});
  });
});
