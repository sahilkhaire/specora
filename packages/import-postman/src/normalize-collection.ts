import type {
  ImportWarning,
  NormalizedCollection,
  NormalizedFolder,
  NormalizedRequest,
  PostmanCollectionFormat
} from "./types.js";
import { detectPostmanFile } from "./detect-format.js";
import { convertV1ToV21 } from "./v1-converter.js";

function toBase64(value: string): string {
  if (typeof globalThis.Buffer !== "undefined") {
    return globalThis.Buffer.from(value).toString("base64");
  }
  return btoa(value);
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function headersToRecord(
  headers: Array<{ key?: string; value?: string; disabled?: boolean }> | undefined
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(headers)) return out;
  for (const h of headers) {
    if (!h?.key || h.disabled) continue;
    out[h.key] = h.value ?? "";
  }
  return out;
}

function urlToString(url: unknown): string {
  if (typeof url === "string") return url;
  if (!url || typeof url !== "object") return "";
  const u = url as Record<string, unknown>;
  if (typeof u.raw === "string" && u.raw) return u.raw;
  const protocol = typeof u.protocol === "string" ? u.protocol : "https";
  const host = Array.isArray(u.host) ? u.host.join(".") : "";
  const path = Array.isArray(u.path) ? `/${u.path.join("/")}` : "";
  return host ? `${protocol}://${host}${path}` : "";
}

function bodyFromRequest(request: Record<string, unknown>): NormalizedRequest["body"] {
  const body = request.body as Record<string, unknown> | undefined;
  if (!body) return { mode: "none", content: "" };
  const mode = typeof body.mode === "string" ? body.mode : "raw";
  if (mode === "raw") {
    return { mode: "raw", content: typeof body.raw === "string" ? body.raw : "" };
  }
  if (mode === "urlencoded" || mode === "formdata") {
    return { mode: "form", content: JSON.stringify(body[mode] ?? [], null, 2) };
  }
  return { mode: "raw", content: typeof body.raw === "string" ? body.raw : "" };
}

function mapAuth(auth: unknown, warnings: ImportWarning[]): NormalizedRequest["auth"] | undefined {
  if (!auth) return undefined;
  const list = Array.isArray(auth) ? auth : [auth];
  const entry = list[0] as Record<string, unknown> | undefined;
  if (!entry || typeof entry !== "object") return undefined;
  const type = entry.type;
  if (type === "bearer") {
    const token = (entry.bearer as { token?: string }[])?.[0]?.token ?? "";
    return { type: "bearer", value: token, keyName: "" };
  }
  if (type === "basic") {
    const basic = (entry.basic as { username?: string; password?: string }[])?.[0];
    const encoded = basic
      ? toBase64(`${basic.username ?? ""}:${basic.password ?? ""}`)
      : "";
    return { type: "basic", value: encoded, keyName: "" };
  }
  if (type === "apikey") {
    const apikey = (entry.apikey as { key?: string; value?: string }[])?.[0];
    return {
      type: "api-key",
      value: apikey?.value ?? "",
      keyName: apikey?.key ?? "X-API-Key"
    };
  }
  if (type && type !== "noauth") {
    warnings.push({
      code: "auth_unsupported",
      message: `Auth type "${String(type)}" was not mapped; configure manually.`
    });
  }
  return undefined;
}

function walkV2Items(
  items: unknown[],
  parentId: string | null,
  folders: NormalizedFolder[],
  requests: NormalizedCollection["requests"],
  warnings: ImportWarning[],
  sortBase: number
): void {
  items.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const node = item as Record<string, unknown>;
    const sortOrder = sortBase + index;

    if (node.request) {
      const req = node.request as Record<string, unknown>;
      const method = typeof req.method === "string" ? req.method.toUpperCase() : "GET";
      requests.push({
        id: uid("req"),
        name: typeof node.name === "string" ? node.name : "Request",
        method,
        url: urlToString(req.url),
        pathParams: {},
        queryParams: {},
        headers: headersToRecord(req.header as Parameters<typeof headersToRecord>[0]),
        body: bodyFromRequest(req),
        auth: mapAuth(req.auth, warnings),
        description: typeof node.description === "string" ? node.description : undefined,
        folderId: parentId,
        sortOrder
      });
      if (Array.isArray(node.event)) {
        warnings.push({
          code: "scripts_skipped",
          message: `Scripts on "${String(node.name)}" were not imported.`
        });
      }
      return;
    }

    const folderId = uid("folder");
    folders.push({
      id: folderId,
      name: typeof node.name === "string" ? node.name : "Folder",
      parentId,
      sortOrder
    });
    if (Array.isArray(node.item)) {
      walkV2Items(node.item, folderId, folders, requests, warnings, sortOrder * 100);
    }
  });
}

function normalizeV21(doc: Record<string, unknown>, format: PostmanCollectionFormat): NormalizedCollection {
  const warnings: ImportWarning[] = [];
  const folders: NormalizedFolder[] = [];
  const requests: NormalizedCollection["requests"] = [];
  const info = doc.info as Record<string, unknown> | undefined;
  const name = typeof info?.name === "string" ? info.name : "Imported Collection";

  if (Array.isArray(doc.item)) {
    walkV2Items(doc.item, null, folders, requests, warnings, 0);
  }

  return { format, name, folders, requests, warnings };
}

function upconvertV20Url(doc: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;

  function fixItems(items: unknown[]): void {
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const node = item as Record<string, unknown>;
      if (node.request && typeof node.request === "object") {
        const req = node.request as Record<string, unknown>;
        if (typeof req.url === "string") {
          req.url = { raw: req.url };
        }
        if (req.auth && !Array.isArray(req.auth)) {
          req.auth = [req.auth];
        }
      }
      if (Array.isArray(node.item)) fixItems(node.item);
    }
  }

  if (Array.isArray(clone.item)) fixItems(clone.item);
  return clone;
}

export async function importPostmanCollection(raw: unknown): Promise<NormalizedCollection | null> {
  const detected = detectPostmanFile(raw);
  if (detected.kind !== "collection" || !raw || typeof raw !== "object") {
    return null;
  }

  let doc = raw as Record<string, unknown>;
  let format = detected.collectionFormat ?? "unknown";

  if (format === "v1") {
    doc = convertV1ToV21(doc);
    format = "v2.1";
  } else if (format === "v2.0") {
    doc = upconvertV20Url(doc);
    format = "v2.1";
  }

  return normalizeV21(doc, format === "unknown" ? "v2.1" : format);
}
