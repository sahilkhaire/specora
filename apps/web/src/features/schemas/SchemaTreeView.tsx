import { useState } from "react";
import type { SchemaFieldNode } from "./schema-samples";

function SchemaTreeNode({ node, depth = 0 }: { node: SchemaFieldNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = Boolean(node.children?.length);

  return (
    <li className="schema-tree-node">
      <div className="schema-tree-row" style={{ paddingLeft: `${depth * 12}px` }}>
        {hasChildren ? (
          <button
            type="button"
            className="schema-tree-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="schema-tree-spacer" />
        )}
        <span className={`schema-tree-name ${node.required ? "is-required" : ""}`}>{node.name}</span>
        <span className="schema-tree-type">{node.type}</span>
        {node.ref ? <span className="schema-tree-ref">{node.ref}</span> : null}
      </div>
      {node.description ? (
        <p className="schema-tree-desc" style={{ paddingLeft: `${depth * 12 + 20}px` }}>
          {node.description}
        </p>
      ) : null}
      {hasChildren && open ? (
        <ul className="schema-tree-children">
          {node.children!.map((child) => (
            <SchemaTreeNode key={`${node.name}-${child.name}`} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function SchemaTreeView({ nodes }: { nodes: SchemaFieldNode[] }) {
  if (nodes.length === 0) {
    return <p className="schema-tree-empty">No fields defined.</p>;
  }

  return (
    <ul className="schema-tree">
      {nodes.map((node) => (
        <SchemaTreeNode key={node.name} node={node} />
      ))}
    </ul>
  );
}
