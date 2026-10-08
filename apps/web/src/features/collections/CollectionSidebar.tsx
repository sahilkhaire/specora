import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CollectionNode, SavedRequest } from "./collection-types";
import { Input } from "@/shared/ui/Input";
import { Button } from "@/shared/ui/Button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { IconPlus, IconUpload } from "@/shared/ui/icons";
import { useShellNav } from "@/shared/ui/shell-nav";

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
  showCollectionActions?: boolean;
}

export function CollectionSidebar({
  nodes,
  requests,
  selectedRequestId,
  onSelectRequest,
  onNewRequest,
  onImportPostman,
  showCollectionActions = true
}: CollectionSidebarProps) {
  const [filter, setFilter] = useState("");
  const { showPane } = useShellNav();
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

  // Roving tabindex (WAI-ARIA tree): the tree is one Tab stop; arrow keys move between rows.
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedIndex = rows.findIndex((row) => row.requestId && row.requestId === selectedRequestId);
  useEffect(() => {
    if (selectedIndex >= 0) setActiveIndex(selectedIndex);
  }, [selectedIndex]);
  const focusIndex = Math.min(activeIndex, Math.max(rows.length - 1, 0));

  function moveFocus(index: number) {
    const next = Math.max(0, Math.min(rows.length - 1, index));
    setActiveIndex(next);
    if (useVirtual) virtualizer.scrollToIndex(next, { align: "auto" });
    requestAnimationFrame(() => {
      parentRef.current?.querySelector<HTMLElement>(`[data-row-index="${next}"]`)?.focus();
    });
  }

  function onTreeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const row = rows[focusIndex];
    if (!row) return;
    const handled = (() => {
      switch (event.key) {
        case "ArrowDown":
          moveFocus(focusIndex + 1);
          return true;
        case "ArrowUp":
          moveFocus(focusIndex - 1);
          return true;
        case "Home":
          moveFocus(0);
          return true;
        case "End":
          moveFocus(rows.length - 1);
          return true;
        case "ArrowRight":
          if (row.kind === "folder" && !expanded.has(row.id)) toggleFolder(row.id);
          else moveFocus(focusIndex + 1);
          return true;
        case "ArrowLeft":
          if (row.kind === "folder" && expanded.has(row.id)) {
            toggleFolder(row.id);
          } else {
            // Jump to the parent folder: the nearest earlier row one level up.
            for (let i = focusIndex - 1; i >= 0; i--) {
              if (rows[i]!.depth < row.depth) {
                moveFocus(i);
                break;
              }
            }
          }
          return true;
        default:
          return false;
      }
    })();
    if (handled) event.preventDefault();
  }

  const toggleFolder = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  function renderRow(row: FlatTreeRow, index: number, style: CSSProperties) {
    const isSelected = row.requestId === selectedRequestId;
    const tabIndex = index === focusIndex ? 0 : -1;
    return (
      <div
        key={row.id}
        className={`collection-tree-row ${isSelected ? "is-selected" : ""}`}
        style={style}
        role="treeitem"
        aria-selected={isSelected}
        aria-level={row.depth + 1}
        aria-expanded={row.kind === "folder" ? expanded.has(row.id) : undefined}
      >
        {row.kind === "folder" ? (
          <button
            type="button"
            className="collection-tree-folder"
            tabIndex={tabIndex}
            data-row-index={index}
            onFocus={() => setActiveIndex(index)}
            onClick={() => toggleFolder(row.id)}
          >
            <span className="collection-tree-chevron" aria-hidden="true">{expanded.has(row.id) ? "▾" : "▸"}</span>
            {row.name}
          </button>
        ) : (
          <button
            type="button"
            className="collection-tree-request"
            tabIndex={tabIndex}
            data-row-index={index}
            onFocus={() => setActiveIndex(index)}
            onClick={() => {
              if (!row.requestId) return;
              onSelectRequest(row.requestId);
              showPane("main");
            }}
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
                className="collection-sidebar-icon-btn collection-sidebar-text-btn"
                onClick={onNewRequest}
              >
                <IconPlus size={14} />
                <span>New request</span>
              </button>
              <button
                type="button"
                className="collection-sidebar-icon-btn collection-sidebar-text-btn"
                onClick={onImportPostman}
                title="Import a Postman collection or environment"
              >
                <IconUpload size={14} />
                <span>Import</span>
              </button>
            </>
          ) : null}
        </div>
      </div>
      <div
        ref={parentRef}
        className="collection-sidebar-list"
        role="tree"
        aria-label="Requests"
        onKeyDown={onTreeKeyDown}
      >
        {useVirtual ? (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index]!;
              return renderRow(row, virtualRow.index, {
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
          rows.map((row, index) =>
            renderRow(row, index, { paddingLeft: `${8 + row.depth * 14}px` })
          )
        )}
      </div>
    </div>
  );
}
