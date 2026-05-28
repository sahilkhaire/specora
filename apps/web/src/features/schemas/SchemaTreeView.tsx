import { useState, type CSSProperties } from "react";
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

const MAX_ENUM_VISIBLE = 10;

function SchemaEnumValues({ values, depth }: { values: string[]; depth: number }) {
  const [expanded, setExpanded] = useState(false);
  const overflow = values.length > MAX_ENUM_VISIBLE;
  const visible = expanded || !overflow ? values : values.slice(0, MAX_ENUM_VISIBLE);

  return (
    <div
      className="schema-tree-enums"
      style={{ paddingLeft: `calc(${depth} * 14px + 2.6rem)` }}
      role="list"
      aria-label="Allowed enum values"
    >
      <span className="schema-tree-enum-label">enum</span>
      {visible.map((value) => (
        <span key={value} className="schema-tree-enum-value" role="listitem" title={value}>
          {value}
        </span>
      ))}
      {overflow && !expanded ? (
        <button
          type="button"
          className="schema-tree-enum-more"
          onClick={() => setExpanded(true)}
        >
          +{values.length - MAX_ENUM_VISIBLE} more
        </button>
      ) : null}
      {overflow && expanded ? (
        <button
          type="button"
          className="schema-tree-enum-more"
          onClick={() => setExpanded(false)}
        >
          Show less
        </button>
      ) : null}
    </div>
  );
}

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
      <div
        className="schema-tree-row"
        style={{ "--depth": depth } as CSSProperties & Record<"--depth", number>}
      >
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
        {node.ref && !node.enumValues?.length ? (
          <span className="schema-tree-ref">{node.ref}</span>
        ) : null}
        {node.preview !== undefined && !node.enumValues?.length ? (
          <code className="schema-tree-preview" title="Template value">
            {node.preview}
          </code>
        ) : null}
      </div>
      {node.enumValues?.length ? (
        <SchemaEnumValues values={node.enumValues} depth={depth} />
      ) : null}
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
