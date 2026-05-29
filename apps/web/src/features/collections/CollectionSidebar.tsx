import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CollectionNode, SavedRequest } from "./collection-types";
import { Input } from "@/shared/ui/Input";
import { Button } from "@/shared/ui/Button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { IconPanelRight, IconPlus, IconUpload } from "@/shared/ui/icons";

export interface FlatTreeRow {
  id: string;
  kind: "folder" | "request";
  depth: number;
  name: string;
  requestId?: string;
  method?: string;
}

function buildFlatTree(
  nodes: CollectionNode[],
  requests: SavedRequest[],
  expanded: Set<string>,
  filter: string
): FlatTreeRow[] {
  const query = filter.trim().toLowerCase();
  const requestById = new Map(requests.map((r) => [r.id, r]));
  const childrenOf = new Map<string | null, CollectionNode[]>();

  for (const node of nodes) {
    const list = childrenOf.get(node.parentId) ?? [];
    list.push(node);
    childrenOf.set(node.parentId, list);
  }

  for (const [, list] of childrenOf) {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const rows: FlatTreeRow[] = [];

  function walk(parentId: string | null, depth: number) {
    const children = childrenOf.get(parentId) ?? [];
    for (const node of children) {
      if (node.kind === "folder") {
        if (!query) {
          rows.push({ id: node.id, kind: "folder", depth, name: node.name });
          if (expanded.has(node.id)) {
            walk(node.id, depth + 1);
          }
          continue;
        }

        const folderNameMatches = node.name.toLowerCase().includes(query);
        const childRowStart = rows.length;
        walk(node.id, depth + 1);
        const hasMatchingRequests = rows.length > childRowStart;

        if (folderNameMatches || hasMatchingRequests) {
          rows.splice(childRowStart, 0, {
            id: node.id,
            kind: "folder",
            depth,
            name: node.name
          });
        }
        continue;
      }

      const req = node.requestId ? requestById.get(node.requestId) : undefined;
      const label = node.name;
      const haystack = `${label} ${req?.method ?? ""} ${req?.url ?? ""}`.toLowerCase();
      if (query && !haystack.includes(query)) continue;

      rows.push({
        id: node.id,
        kind: "request",
        depth,
        name: label,
        requestId: node.requestId,
        method: req?.method
      });
    }
  }

  walk(null, 0);
  return rows;
}

interface CollectionSidebarProps {
  nodes: CollectionNode[];
  requests: SavedRequest[];
  selectedRequestId: string;
  onSelectRequest: (requestId: string) => void;
  onNewRequest: () => void;
  onImportPostman: () => void;
  schemaPanelOpen?: boolean;
  onToggleSchemaPanel?: () => void;
  showCollectionActions?: boolean;
}

export function CollectionSidebar({
  nodes,
  requests,
  selectedRequestId,
  onSelectRequest,
  onNewRequest,
  onImportPostman,
  schemaPanelOpen = false,
  onToggleSchemaPanel,
  showCollectionActions = true
}: CollectionSidebarProps) {
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const folderIds = nodes.filter((n) => n.kind === "folder").map((n) => n.id);
    setExpanded(new Set(folderIds));
  }, [nodes]);

  const rows = useMemo(
    () => buildFlatTree(nodes, requests, expanded, filter),
    [nodes, requests, expanded, filter]
  );

  const useVirtual = rows.length > 80;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 12,
    enabled: useVirtual
  });

  const toggleFolder = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  function renderRow(row: FlatTreeRow, style: CSSProperties) {
    const isSelected = row.requestId === selectedRequestId;
    return (
      <div
        key={row.id}
        className={`collection-tree-row ${isSelected ? "is-selected" : ""}`}
        style={style}
        role="treeitem"
        aria-selected={isSelected}
      >
        {row.kind === "folder" ? (
          <button
            type="button"
            className="collection-tree-folder"
            onClick={() => toggleFolder(row.id)}
          >
            <span className="collection-tree-chevron">{expanded.has(row.id) ? "▾" : "▸"}</span>
            {row.name}
          </button>
        ) : (
          <button
            type="button"
            className="collection-tree-request"
            onClick={() => row.requestId && onSelectRequest(row.requestId)}
          >
            {row.method ? (
              <span className={`method-badge method-${row.method.toLowerCase()}`}>{row.method}</span>
            ) : null}
            <span className="collection-tree-label">{row.name}</span>
          </button>
        )}
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="collection-sidebar">
        <EmptyState
          title="No requests yet"
          description={
            showCollectionActions
              ? "Load an OpenAPI spec or import a Postman collection."
              : "No requests available for this API."
          }
          action={
            showCollectionActions ? (
              <div className="collection-sidebar-actions">
                <Button variant="secondary" onClick={onImportPostman}>
                  Import Postman
                </Button>
              </div>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="collection-sidebar">
      <div className="collection-sidebar-toolbar">
        <Input
          placeholder="Search requests…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Search collection"
        />
        <div className="collection-sidebar-actions">
          {showCollectionActions ? (
            <>
              <button
                type="button"
                className="collection-sidebar-icon-btn"
                onClick={onNewRequest}
                title="New request"
                aria-label="New request"
              >
                <IconPlus size={15} />
              </button>
              <button
                type="button"
                className="collection-sidebar-icon-btn"
                onClick={onImportPostman}
                title="Import Postman"
                aria-label="Import Postman"
              >
                <IconUpload size={15} />
              </button>
            </>
          ) : null}
          {onToggleSchemaPanel ? (
            <button
              type="button"
              className={`collection-sidebar-panel-toggle${schemaPanelOpen ? " collection-sidebar-panel-toggle--active" : ""}`}
              onClick={onToggleSchemaPanel}
              aria-label={schemaPanelOpen ? "Hide schema panel" : "Show schema panel"}
              aria-pressed={schemaPanelOpen}
              title={schemaPanelOpen ? "Hide schema panel" : "Show schema panel"}
            >
              <IconPanelRight size={16} />
            </button>
          ) : null}
        </div>
      </div>
      <div ref={parentRef} className="collection-sidebar-list" role="tree">
        {useVirtual ? (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index]!;
              return renderRow(row, {
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                paddingLeft: `${8 + row.depth * 14}px`
              });
            })}
          </div>
        ) : (
          rows.map((row) =>
            renderRow(row, { paddingLeft: `${8 + row.depth * 14}px` })
          )
        )}
      </div>
    </div>
  );
}
