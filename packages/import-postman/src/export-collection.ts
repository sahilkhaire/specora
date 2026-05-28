import type { NormalizedCollection, NormalizedRequest } from "./types.js";

function requestToItem(req: NormalizedRequest & { folderId: string | null; sortOrder: number }) {
  const headers = Object.entries(req.headers).map(([key, value]) => ({ key, value }));
  return {
    name: req.name,
    request: {
      method: req.method,
      header: headers,
      url: { raw: req.url },
      body:
        req.body.mode === "none"
          ? undefined
          : {
              mode: "raw",
              raw: req.body.content
            },
      auth:
        req.auth?.type === "bearer"
          ? [{ type: "bearer", bearer: [{ key: "token", value: req.auth.value, type: "string" }] }]
          : req.auth?.type === "basic"
            ? [
                {
                  type: "basic",
                  basic: [
                    { key: "username", value: "", type: "string" },
                    { key: "password", value: req.auth.value, type: "string" }
                  ]
                }
              ]
            : req.auth?.type === "api-key"
              ? [
                  {
                    type: "apikey",
                    apikey: [
                      { key: "key", value: req.auth.keyName, type: "string" },
                      { key: "value", value: req.auth.value, type: "string" },
                      { key: "in", value: "header", type: "string" }
                    ]
                  }
                ]
              : undefined
    }
  };
}

function buildFolderTree(
  collection: NormalizedCollection
): Array<Record<string, unknown>> {
  const rootRequests = collection.requests
    .filter((r) => !r.folderId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(requestToItem);

  const childFolders = collection.folders.filter((f) => !f.parentId);
  const folderItems = childFolders
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((folder) => {
      const nested = collection.folders.filter((f) => f.parentId === folder.id);
      const reqs = collection.requests
        .filter((r) => r.folderId === folder.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(requestToItem);
      return {
        name: folder.name,
        item: [
          ...nested.map((nf) => ({
            name: nf.name,
            item: collection.requests
              .filter((r) => r.folderId === nf.id)
              .map(requestToItem)
          })),
          ...reqs
        ]
      };
    });

  return [...folderItems, ...rootRequests];
}

export function exportPostmanCollectionV21(collection: NormalizedCollection): Record<string, unknown> {
  return {
    info: {
      name: collection.name,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    item: buildFolderTree(collection)
  };
}

export function exportPostmanEnvironment(
  name: string,
  variables: Record<string, string>
): Record<string, unknown> {
  return {
    name,
    values: Object.entries(variables).map(([key, value]) => ({
      key,
      value,
      type: "default",
      enabled: true
    }))
  };
}
