/**
 * Lightweight Postman Collection v1 → v2.1 converter (browser-safe).
 * Covers common exports: folders, requests, string/array headers, raw body.
 */
export function convertV1ToV21(doc: Record<string, unknown>): Record<string, unknown> {
  const name = typeof doc.name === "string" ? doc.name : "Imported Collection";
  const folders = Array.isArray(doc.folders)
    ? (doc.folders as Array<Record<string, unknown>>)
    : [];
  const requests = Array.isArray(doc.requests)
    ? (doc.requests as Array<Record<string, unknown>>)
    : [];

  type FolderNode = {
    id: string;
    name: string;
    parentId: string | null;
    items: Array<Record<string, unknown>>;
  };

  const folderMap = new Map<string, FolderNode>();

  for (const folder of folders) {
    const id = String(folder.id ?? `folder_${folderMap.size}`);
    const parentRaw = folder.folder ?? folder.folder_id;
    folderMap.set(id, {
      id,
      name: String(folder.name ?? "Folder"),
      parentId: parentRaw != null && parentRaw !== "" ? String(parentRaw) : null,
      items: []
    });
  }

  const rootItems: Array<Record<string, unknown>> = [];

  for (const req of requests) {
    const item = requestToV21Item(req);
    const folderRef = req.folder ?? req.folder_id;
    const folderId = folderRef != null && folderRef !== "" ? String(folderRef) : null;

    if (folderId && folderMap.has(folderId)) {
      folderMap.get(folderId)!.items.push(item);
    } else {
      rootItems.push(item);
    }
  }

  function folderToItem(folder: FolderNode): Record<string, unknown> {
    const childFolders = [...folderMap.values()].filter((f) => f.parentId === folder.id);
    return {
      name: folder.name,
      item: [...childFolders.map(folderToItem), ...folder.items]
    };
  }

  const rootFolders = [...folderMap.values()].filter(
    (f) => !f.parentId || !folderMap.has(f.parentId)
  );

  return {
    info: {
      name,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    item: [...rootFolders.map(folderToItem), ...rootItems]
  };
}

function requestToV21Item(req: Record<string, unknown>): Record<string, unknown> {
  const method = typeof req.method === "string" ? req.method.toUpperCase() : "GET";
  const urlRaw = typeof req.url === "string" ? req.url : "";

  const request: Record<string, unknown> = {
    method,
    header: parseV1Headers(req.headers),
    url: { raw: urlRaw }
  };

  if (req.dataMode === "raw" && typeof req.rawModeData === "string") {
    request.body = { mode: "raw", raw: req.rawModeData };
  } else if (req.dataMode === "urlencoded" && Array.isArray(req.data)) {
    request.body = {
      mode: "urlencoded",
      urlencoded: (req.data as Array<Record<string, unknown>>).map((entry) => ({
        key: String(entry.key ?? ""),
        value: String(entry.value ?? "")
      }))
    };
  }

  return {
    name: String(req.name ?? "Request"),
    request
  };
}

function parseV1Headers(
  headers: unknown
): Array<{ key: string; value: string }> {
  if (typeof headers === "string") {
    return headers
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const colon = line.indexOf(":");
        if (colon === -1) return { key: line, value: "" };
        return {
          key: line.slice(0, colon).trim(),
          value: line.slice(colon + 1).trim()
        };
      })
      .filter((h) => h.key);
  }

  if (Array.isArray(headers)) {
    return headers
      .map((h) => {
        if (!h || typeof h !== "object") return null;
        const row = h as Record<string, unknown>;
        const key = String(row.key ?? row.name ?? "");
        if (!key) return null;
        return { key, value: String(row.value ?? "") };
      })
      .filter((h): h is { key: string; value: string } => h !== null);
  }

  return [];
}
