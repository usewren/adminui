import React from "react";
import type { User } from "./api";

interface LayoutProps {
  user: User;
  onSignOut: () => void;
  collectionInput: string;
  onCollectionInput: (val: string) => void;
  children: React.ReactNode;
}

export function Layout({
  user,
  onSignOut,
  collectionInput,
  onCollectionInput,
  children,
}: LayoutProps) {
  function navigateToCollection() {
    const name = collectionInput.trim();
    if (name) {
      window.location.hash = `#/collections/${name}`;
    }
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__logo">Wren</div>
        <nav className="admin-sidebar__nav">
          <input
            className="admin-sidebar__collection-input wren-input"
            placeholder="Collection name…"
            value={collectionInput}
            onChange={(e) => onCollectionInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") navigateToCollection();
            }}
          />
        </nav>
        <div className="admin-sidebar__user">
          <div>{user.name}</div>
          <div style={{ fontSize: 12, color: "var(--wren-text-muted)" }}>{user.email}</div>
          <button
            className="wren-btn wren-btn--ghost wren-btn--sm"
            onClick={onSignOut}
            type="button"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="admin-main">
        {children}
      </main>
    </div>
  );
}
