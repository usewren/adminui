import React, { useEffect, useState } from "react";
import { listCollections, type CollectionInfo, type User } from "./api";

interface LayoutProps {
  user: User;
  onSignOut: () => void;
  activeCollection: string | null;
  activeSection: "collections" | "tree" | "settings";
  children: React.ReactNode;
}

export function Layout({ user, onSignOut, activeCollection, activeSection, children }: LayoutProps) {
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [input, setInput] = useState("");
  const [showNewInput, setShowNewInput] = useState(false);
  const [newInput, setNewInput] = useState("");

  useEffect(() => {
    listCollections().then(setCollections).catch(() => {});
  }, []);

  // Refresh collection list when navigating back to a collection (new docs may have been added)
  useEffect(() => {
    listCollections().then(setCollections).catch(() => {});
  }, [activeCollection]);

  function navigate(name: string) {
    window.location.hash = `#/collections/${name}`;
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__logo">
          <img src="/wren-logo.svg" alt="" style={{ width: 24, height: 24, borderRadius: 5, marginRight: 8, verticalAlign: "middle" }} />
          Wren
        </div>
        <nav className="admin-sidebar__nav">
          <div className="admin-sidebar__section-links">
            <span
              className={`admin-sidebar__section-link${activeSection === "collections" ? " admin-sidebar__section-link--active" : ""}`}
              onClick={() => { window.location.hash = "#/"; }}
            >
              Collections
            </span>
            <span
              className={`admin-sidebar__section-link${activeSection === "tree" ? " admin-sidebar__section-link--active" : ""}`}
              onClick={() => { window.location.hash = "#/tree/main/"; }}
            >
              Tree
            </span>
            <span
              className={`admin-sidebar__section-link${activeSection === "settings" ? " admin-sidebar__section-link--active" : ""}`}
              onClick={() => { window.location.hash = "#/settings/api-keys"; }}
            >
              Settings
            </span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = input.trim();
              if (name) navigate(name);
            }}
          >
            <input
              className="admin-sidebar__collection-input wren-input"
              placeholder="Go to collection…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </form>

          {activeSection === "settings" && (
            <div className="admin-sidebar__collections">
              <div
                className={`admin-sidebar__nav-item${window.location.hash.includes("api-keys") ? " admin-sidebar__nav-item--active" : ""}`}
                onClick={() => { window.location.hash = "#/settings/api-keys"; }}
              >
                API Keys
              </div>
              <div
                className={`admin-sidebar__nav-item${window.location.hash.includes("components") ? " admin-sidebar__nav-item--active" : ""}`}
                onClick={() => { window.location.hash = "#/settings/components"; }}
              >
                Component Library
              </div>
            </div>
          )}

          <div className="admin-sidebar__collections">
            {collections.map((c) => (
              <div
                key={c.name}
                className={`admin-sidebar__nav-item${activeCollection === c.name ? " admin-sidebar__nav-item--active" : ""}`}
                onClick={() => navigate(c.name)}
              >
                <span className="admin-sidebar__coll-name">{c.name}</span>
                <span className="admin-sidebar__coll-count">{c.count}</span>
              </div>
            ))}
            {showNewInput ? (
              <form
                className="admin-sidebar__new-collection-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newInput.trim();
                  if (name) { navigate(name); setShowNewInput(false); setNewInput(""); }
                }}
              >
                <input
                  autoFocus
                  className="admin-sidebar__collection-input wren-input"
                  placeholder="Collection name…"
                  value={newInput}
                  onChange={(e) => setNewInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") { setShowNewInput(false); setNewInput(""); } }}
                />
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  <button className="wren-btn wren-btn--primary wren-btn--sm" type="submit" style={{ flex: 1 }}>
                    Go →
                  </button>
                  <button
                    className="wren-btn wren-btn--ghost wren-btn--sm"
                    type="button"
                    onClick={() => { setShowNewInput(false); setNewInput(""); }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div
                className="admin-sidebar__nav-item admin-sidebar__nav-item--new"
                onClick={() => setShowNewInput(true)}
              >
                + New collection
              </div>
            )}
          </div>
        </nav>
        <div className="admin-sidebar__user">
          <div style={{ fontWeight: 600 }}>{user.name}</div>
          <div style={{ fontSize: 12, color: "var(--wren-text-muted)" }}>{user.email}</div>
          <button className="wren-btn wren-btn--ghost wren-btn--sm" onClick={onSignOut} type="button">
            Sign out
          </button>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
