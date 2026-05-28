export type SampleMode = "empty" | "example";

function resolveRef(spec: Record<string, unknown>, ref: string): unknown {
  if (!ref.startsWith("#/")) return null;
  const segments = ref
    .slice(2)
    .split("/")
    .map((s) => decodeURIComponent(s).replace(/~1/g, "/").replace(/~0/g, "~"));
  let current: unknown = spec;
  for (const segment of segments) {
    if (!current || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function refName(ref: string): string {
  const parts = ref.split("/");
  return parts[parts.length - 1] ?? ref;
}

function mergeAllOf(spec: Record<string, unknown>, schemas: unknown[]): Record<string, unknown> {
  const merged: Record<string, unknown> = { type: "object", properties: {} };
  const properties: Record<string, unknown> = {};
  const required = new Set<string>();

  for (const entry of schemas) {
    const sample = generateSampleValue(spec, entry, "empty", 0, new Set());
    if (sample && typeof sample === "object" && !Array.isArray(sample)) {
      Object.assign(properties, sample as Record<string, unknown>);
    }
    const resolved = typeof entry === "object" && entry && (entry as Record<string, unknown>).$ref
      ? resolveRef(spec, String((entry as Record<string, unknown>).$ref))
      : entry;
    if (resolved && typeof resolved === "object") {
      const r = resolved as Record<string, unknown>;
      if (r.properties && typeof r.properties === "object") {
        Object.assign(properties, r.properties as Record<string, unknown>);
      }
      if (Array.isArray(r.required)) {
        r.required.forEach((k) => typeof k === "string" && required.add(k));
      }
    }
  }

  merged.properties = properties;
  if (required.size > 0) merged.required = Array.from(required);
  return merged;
}

export function generateSampleValue(
  spec: Record<string, unknown>,
  schema: unknown,
  mode: SampleMode = "empty",
  depth = 0,
  visited = new Set<string>()
): unknown {
  if (depth > 14) return null;
  if (!schema || typeof schema !== "object") return null;

  const s = schema as Record<string, unknown>;

  if (typeof s.$ref === "string") {
    const ref = s.$ref;
    if (visited.has(ref)) return mode === "empty" ? {} : null;
    visited.add(ref);
    const resolved = resolveRef(spec, ref);
    if (!resolved) return mode === "empty" ? {} : null;
    return generateSampleValue(spec, resolved, mode, depth + 1, visited);
  }

  if (mode === "example") {
    if (s.example !== undefined) return s.example;
    if (s.default !== undefined) return s.default;
    if (Array.isArray(s.enum) && s.enum.length > 0) return s.enum[0];
  }

  if (Array.isArray(s.oneOf) && s.oneOf.length > 0) {
    return generateSampleValue(spec, s.oneOf[0], mode, depth + 1, visited);
  }
  if (Array.isArray(s.anyOf) && s.anyOf.length > 0) {
    return generateSampleValue(spec, s.anyOf[0], mode, depth + 1, visited);
  }
  if (Array.isArray(s.allOf) && s.allOf.length > 0) {
    return generateSampleValue(spec, mergeAllOf(spec, s.allOf), mode, depth + 1, visited);
  }

  const type = typeof s.type === "string" ? s.type : undefined;

  if (type === "array" || s.items) {
    const item = generateSampleValue(spec, s.items ?? { type: "string" }, mode, depth + 1, visited);
    return item === undefined ? [] : [item];
  }

  if (type === "object" || s.properties) {
    const props = (s.properties as Record<string, unknown> | undefined) ?? {};
    const keys = Object.keys(props);
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      if (key in props) {
        out[key] = generateSampleValue(spec, props[key], mode, depth + 1, new Set(visited));
      }
    }
    return out;
  }

  switch (type) {
    case "string":
      if (s.format === "date") return "2024-01-01";
      if (s.format === "date-time") return "2024-01-01T00:00:00Z";
      if (s.format === "email") return "user@example.com";
      if (s.format === "uuid") return "00000000-0000-4000-8000-000000000000";
      return "";
    case "integer":
      return 0;
    case "number":
      return 0;
    case "boolean":
      return false;
    default:
      if (Array.isArray(s.enum) && s.enum.length > 0) return s.enum[0];
      return null;
  }
}

export function sampleToJson(
  spec: Record<string, unknown>,
  schema: unknown,
  mode: SampleMode = "empty"
): string {
  const value = generateSampleValue(spec, schema, mode);
  if (value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

export type SchemaFieldKind =
  | "object"
  | "array"
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "ref"
  | "union"
  | "unknown";

export interface SchemaFieldNode {
  name: string;
  type: string;
  kind: SchemaFieldKind;
  required: boolean;
  description: string;
  ref?: string;
  format?: string;
  preview?: string;
  children?: SchemaFieldNode[];
}

export function shortSchemaName(name: string): string {
  if (!name) return name;
  const segment = name.includes(".") ? name.split(".").pop() ?? name : name;
  return segment.replace(/Input$/i, "").replace(/Output$/i, "") || segment;
}

function inferKind(type: string, hasChildren: boolean): SchemaFieldKind {
  if (hasChildren && type === "array") return "array";
  if (hasChildren) return "object";
  if (type === "string") return "string";
  if (type === "integer") return "integer";
  if (type === "number") return "number";
  if (type === "boolean") return "boolean";
  if (type === "ref") return "ref";
  if (type.startsWith("oneOf") || type.startsWith("anyOf")) return "union";
  return "unknown";
}

function formatPreview(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "object") {
    if (Array.isArray(value)) return value.length === 0 ? "[]" : `[${value.length}]`;
    return undefined;
  }
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 28 ? `${text.slice(0, 25)}…` : text;
}

function nodePreview(
  spec: Record<string, unknown>,
  prop: unknown,
  mode: SampleMode
): string | undefined {
  return formatPreview(generateSampleValue(spec, prop, mode));
}

export function buildSchemaTree(
  spec: Record<string, unknown>,
  schema: unknown,
  depth = 0,
  visited = new Set<string>(),
  mode: SampleMode = "empty"
): SchemaFieldNode[] {
  if (depth > 10 || !schema || typeof schema !== "object") return [];

  const s = schema as Record<string, unknown>;

  if (typeof s.$ref === "string") {
    const ref = s.$ref;
    if (visited.has(ref)) {
      return [
        {
          name: shortSchemaName(refName(ref)),
          type: "ref",
          kind: "ref",
          required: false,
          description: "Circular reference",
          ref: refName(ref)
        }
      ];
    }
    visited.add(ref);
    const resolved = resolveRef(spec, ref);
    if (!resolved) {
      return [
        {
          name: shortSchemaName(refName(ref)),
          type: "ref",
          kind: "ref",
          required: false,
          description: "Unresolved $ref",
          ref: refName(ref)
        }
      ];
    }
    return buildSchemaTree(spec, resolved, depth, visited, mode);
  }

  if (Array.isArray(s.oneOf) && s.oneOf.length > 0) {
    return [
      {
        name: "oneOf",
        type: `oneOf (${s.oneOf.length})`,
        kind: "union",
        required: false,
        description: "First variant shown",
        children: buildSchemaTree(spec, s.oneOf[0], depth + 1, visited, mode)
      }
    ];
  }

  if (Array.isArray(s.anyOf) && s.anyOf.length > 0) {
    return [
      {
        name: "anyOf",
        type: `anyOf (${s.anyOf.length})`,
        kind: "union",
        required: false,
        description: "",
        children: buildSchemaTree(spec, s.anyOf[0], depth + 1, visited, mode)
      }
    ];
  }

  const type = typeof s.type === "string" ? s.type : "object";

  if (type === "array" || s.items) {
    return [
      {
        name: "items",
        type: "array",
        kind: "array",
        required: false,
        description: typeof s.description === "string" ? s.description : "",
        preview: nodePreview(spec, s, mode),
        children: buildSchemaTree(spec, s.items ?? {}, depth + 1, visited, mode)
      }
    ];
  }

  if (s.properties && typeof s.properties === "object") {
    const requiredSet = new Set(
      Array.isArray(s.required)
        ? s.required.filter((k): k is string => typeof k === "string")
        : []
    );
    return Object.entries(s.properties as Record<string, unknown>).map(([name, prop]) => {
      const propRecord =
        prop && typeof prop === "object" ? (prop as Record<string, unknown>) : {};
      const refFull =
        typeof propRecord.$ref === "string" ? refName(String(propRecord.$ref)) : undefined;
      const propType =
        typeof propRecord.type === "string"
          ? propRecord.type
          : refFull
            ? shortSchemaName(refFull)
            : "object";
      const hasNested =
        propRecord.properties ||
        propRecord.items ||
        propRecord.$ref ||
        propRecord.oneOf ||
        propRecord.anyOf;
      const kind = inferKind(
        typeof propRecord.type === "string" ? propRecord.type : refFull ? "ref" : "object",
        Boolean(hasNested)
      );
      return {
        name,
        type: propType,
        kind,
        required: requiredSet.has(name),
        description: typeof propRecord.description === "string" ? propRecord.description : "",
        ref: refFull,
        format: typeof propRecord.format === "string" ? propRecord.format : undefined,
        preview: hasNested ? undefined : nodePreview(spec, prop, mode),
        children: hasNested ? buildSchemaTree(spec, prop, depth + 1, new Set(visited), mode) : undefined
      };
    });
  }

  return [
    {
      name: "(value)",
      type,
      kind: inferKind(type, false),
      required: false,
      description: typeof s.description === "string" ? s.description : "",
      preview: nodePreview(spec, s, mode)
    }
  ];
}

export function countSchemaTree(nodes: SchemaFieldNode[]): { fields: number; required: number } {
  let fields = 0;
  let required = 0;

  const walk = (list: SchemaFieldNode[]) => {
    for (const node of list) {
      if (node.name !== "items" && node.name !== "oneOf" && node.name !== "anyOf") {
        fields += 1;
        if (node.required) required += 1;
      }
      if (node.children?.length) walk(node.children);
    }
  };

  walk(nodes);
  return { fields, required };
}
