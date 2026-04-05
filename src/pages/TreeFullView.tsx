import React, { useEffect, useState } from "react";
import { Spinner, Badge } from "componentlibrary";
import { listFullTree, getCollectionSchema, type FullTreeNode } from "../api";
import { applyDisplayRule } from "./CollectionPage";

interface TreeViewNode {
  segment: string;
  fullPath: string;
  node?: FullTreeNode;
  children: TreeViewNode[];
  expanded: boolean;
}

function buildTree(nodes: FullTreeNode[]): TreeViewNode[] {
  const root: TreeViewNode[] = [];

  function upsert(parts: string[], idx: number, arr: TreeViewNode[], fullPath: string, node: FullTreeNode): void {
    const segment = parts[idx];
    let existing = arr.find((n) => n.segment === segment);
    if (!existing) {
      existing = { segment, fullPath: "/" + parts.slice(0, idx + 1).join("/"), node: undefined, children: [], expanded: true };
      arr.push(existing);
    }
    if (idx === parts.length - 1) {
      existing.node = node;
      existing.fullPath = fullPath;
    } else {
      upsert(parts, idx + 1, existing.children, fullPath, node);
    }
  }

  for (const n of nodes) {
    const parts = n.path.split("/").filter(Boolean);
    if (parts.length === 0) continue;
    upsert(parts, 0, root, n.path, n);
  }

  return root;
}

function TreeNodeRow({
  node,
  depth,
  treeName,
  displayRules,
  onToggle,
}: {
  node: TreeViewNode;
  depth: number;
  treeName: string;
  displayRules: Record<string, string>;
  onToggle: (path: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const indent = depth * 18;

  const preview = node.node
    ? (() => {
        const rule = displayRules[node.node.document.collection];
        if (rule) return applyDisplayRule(rule, node.node.document.data as Record<string, unknown>);
        const firstKey = Object.keys(node.node.document.data)[0];
        return firstKey ? `${firstKey}: ${JSON.stringify(node.node.document.data[firstKey])}` : "(empty)";
      })()
    : null;

  return (
    <>
      <div
        className="tree-child"
        style={{ paddingLeft: indent + 8, cursor: "pointer", gap: 6 }}
        onClick={() => {
          if (hasChildren) onToggle(node.fullPath);
          window.location.hash = `#/tree/${treeName}${node.fullPath}`;
        }}
      >
        <span style={{ width: 14, display: "inline-block", textAlign: "center", fontSize: 10, flexShrink: 0, color: "var(--wren-text-muted)" }}>
          {hasChildren ? (node.expanded ? "▼" : "▶") : "·"}
        </span>
        <span className="tree-child__segment" style={{ flexShrink: 0 }}>/{node.segment}</span>
        {node.node && (
          <>
            <span style={{ fontSize: 11, color: "var(--wren-text-muted)", marginLeft: 4, flexShrink: 0 }}>
              {node.node.document.collection}
            </span>
            <Badge label={`v${node.node.document.version}`} variant="blue" />
            <span style={{ fontSize: 12, color: "var(--wren-text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {preview}
            </span>
          </>
        )}
        {!node.node && (
          <span style={{ fontSize: 12, color: "var(--wren-text-muted)", fontStyle: "italic" }}>
            (no document)
          </span>
        )}
      </div>
      {node.expanded && node.children.map((child) => (
        <TreeNodeRow
          key={child.fullPath}
          node={child}
          depth={depth + 1}
          treeName={treeName}
          displayRules={displayRules}
          onToggle={onToggle}
        />
      ))}
    </>
  );
}

export function TreeFullView({ treeName }: { treeName: string }) {
  const [nodes, setNodes] = useState<FullTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeViewNode[]>([]);
  const [displayRules, setDisplayRules] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    setError(null);
    listFullTree(treeName)
      .then(async (ns) => {
        setNodes(ns);
        setTree(buildTree(ns));
        // Fetch display rules for each distinct collection that has nodes
        const collections = [...new Set(ns.map(n => n.document.collection))];
        const rules: Record<string, string> = {};
        await Promise.all(collections.map(async (col) => {
          const schema = await getCollectionSchema(col).catch(() => null);
          if (schema?.displayName) rules[col] = schema.displayName;
        }));
        setDisplayRules(rules);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load tree"))
      .finally(() => setLoading(false));
  }, [treeName]);

  function handleToggle(fullPath: string) {
    function toggleIn(arr: TreeViewNode[]): TreeViewNode[] {
      return arr.map((n) => {
        if (n.fullPath === fullPath) return { ...n, expanded: !n.expanded };
        if (fullPath.startsWith(n.fullPath + "/")) return { ...n, children: toggleIn(n.children) };
        return n;
      });
    }
    setTree((prev) => toggleIn(prev));
  }

  if (loading) return <div className="admin-spinner-center"><Spinner size="lg" /></div>;
  if (error) return <div className="admin-error">{error}</div>;

  if (nodes.length === 0) {
    return (
      <div style={{ fontSize: 13, color: "var(--wren-text-muted)", padding: "24px 0" }}>
        Tree <strong>{treeName}</strong> has no assigned paths yet.
      </div>
    );
  }

  return (
    <div className="tree-children" style={{ marginTop: 8 }}>
      {tree.map((node) => (
        <TreeNodeRow
          key={node.fullPath}
          node={node}
          depth={0}
          treeName={treeName}
          displayRules={displayRules}
          onToggle={handleToggle}
        />
      ))}
    </div>
  );
}
