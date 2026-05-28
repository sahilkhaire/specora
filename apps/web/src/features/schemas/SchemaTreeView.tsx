import { useState } from "react";
import type { SchemaFieldKind, SchemaFieldNode } from "./schema-samples";

const TYPE_ICONS: Record<SchemaFieldKind, string> = {
  object: "{}",
  array: "[]",
  string: "Aa",
  number: "#",
  integer: "#",
  boolean: "⊘",
  ref: "↗",
  union: "∪",
  unknown: "?"
};

function SchemaTreeNode({
  node,
  depth = 0,
  forceOpen
}: {
  node: SchemaFieldNode;
  depth?: number;
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = Boolean(node.children?.length);
  const isOpen = forceOpen ?? open;

  return (
    <li className="schema-tree-node">
      <div className="schema-tree-row" style={{ "--depth": depth } as React.CSSProperties}>
        {hasChildren ? (
          <button
            type="button"
            className="schema-tree-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={isOpen}
            aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
          >
            {isOpen ? "▾" : "▸"}
          </button>
        ) : (
          <span className="schema-tree-spacer" />
        )}
        <span className={`schema-kind schema-kind--${node.kind}`} title={node.type}>
          {TYPE_ICONS[node.kind]}
        </span>
        <span className={`schema-tree-name ${node.required ? "is-required" : ""}`}>{node.name}</span>
        <span className={`schema-tree-type schema-tree-type--${node.kind}`}>
          {node.type}
          {node.format ? <span className="schema-tree-format">{node.format}</span> : null}
        </span>
        {node.ref ? <span className="schema-tree-ref">{node.ref}</span> : null}
        {node.preview !== undefined ? (
          <code className="schema-tree-preview" title="Template value">
            {node.preview}
          </code>
        ) : null}
      </div>
      {node.description ? (
        <p
          className="schema-tree-desc"
          style={{ paddingLeft: `calc(${depth} * 14px + 2.6rem)` }}
        >
          {node.description}
        </p>
      ) : null}
      {hasChildren && isOpen ? (
        <ul className="schema-tree-children">
          {node.children!.map((child) => (
            <SchemaTreeNode
              key={`${node.name}-${child.name}-${child.type}`}
              node={child}
              depth={depth + 1}
              forceOpen={forceOpen}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function SchemaTreeView({ nodes }: { nodes: SchemaFieldNode[] }) {
  const [expandAll, setExpandAll] = useState(false);

  if (nodes.length === 0) {
    return <p className="schema-tree-empty">No fields defined in this schema.</p>;
  }

  return (
    <div className="schema-tree-wrap">
      <div className="schema-tree-toolbar">
        <button
          type="button"
          className="schema-tree-toolbar-btn"
          onClick={() => setExpandAll((v) => !v)}
        >
          {expandAll ? "Collapse all" : "Expand all"}
        </button>
      </div>
      <ul className="schema-tree">
        {nodes.map((node) => (
          <SchemaTreeNode key={node.name} node={node} depth={0} forceOpen={expandAll ? true : undefined} />
        ))}
      </ul>
    </div>
  );
}
