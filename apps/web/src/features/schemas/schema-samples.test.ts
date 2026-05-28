import { describe, expect, it } from "vitest";
import {
  buildSchemaTree,
  countSchemaTree,
  generateSampleValue,
  sampleToJson,
  shortSchemaName
} from "./schema-samples";

const spec = {
  openapi: "3.0.3",
  components: {
    schemas: {
      Pet: {
        type: "object",
        required: ["name"],
        properties: {
          id: { type: "integer", example: 42 },
          name: { type: "string" },
          tag: { type: "string", enum: ["dog", "cat"] }
        }
      }
    }
  }
};

describe("schema-samples", () => {
  it("generates empty object from inline schema", () => {
    const schema = {
      type: "object",
      properties: {
        from: { type: "string" },
        count: { type: "integer" }
      }
    };
    expect(generateSampleValue(spec, schema, "empty")).toEqual({ from: "", count: 0 });
  });

  it("generates example values when present", () => {
    const schema = { $ref: "#/components/schemas/Pet" };
    const value = generateSampleValue(spec, schema, "example") as Record<string, unknown>;
    expect(value.id).toBe(42);
    expect(value.name).toBe("");
    expect(value.tag).toBe("dog");
  });

  it("produces formatted JSON", () => {
    const json = sampleToJson(spec, { type: "object", properties: { ok: { type: "boolean" } } }, "empty");
    expect(json).toContain('"ok": false');
  });

  it("builds schema tree with required markers", () => {
    const tree = buildSchemaTree(spec, { $ref: "#/components/schemas/Pet" });
    const nameNode = tree.find((n) => n.name === "name");
    expect(nameNode?.required).toBe(true);
    expect(nameNode?.kind).toBe("string");
  });

  it("shortens dotted schema names", () => {
    expect(shortSchemaName("CAMPAIGN.CAMPAIGN_AUDIENCEINPUT")).toBe("CAMPAIGN_AUDIENCE");
  });

  it("counts fields in tree", () => {
    const tree = buildSchemaTree(spec, { $ref: "#/components/schemas/Pet" });
    expect(countSchemaTree(tree).fields).toBe(3);
    expect(countSchemaTree(tree).required).toBe(1);
  });
});
