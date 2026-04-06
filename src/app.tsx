import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "componentlibrary/styles";
import "./app.css";
import { getSession, signOut, type User } from "./api";
import { Layout } from "./layout";
import { LoginPage } from "./pages/LoginPage";
import { CollectionPage } from "./pages/CollectionPage";
import { DocumentPage } from "./pages/DocumentPage";
import { TreePage } from "./pages/TreePage";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { ComponentsPage } from "./pages/ComponentsPage";
import { CollaboratorsPage } from "./pages/CollaboratorsPage";
import { AcceptInvitePage } from "./pages/AcceptInvitePage";
import { PermissionsPage } from "./pages/PermissionsPage";

type Route =
  | { page: "landing" }
  | { page: "collection"; name: string; tab?: "documents" | "schema" | "access" }
  | { page: "document"; collection: string; id: string; tab?: "data" | "history" | "paths" }
  | { page: "tree"; treeName: string; path: string; view?: "browse" | "full" }
  | { page: "apikeys" }
  | { page: "components" }
  | { page: "collaborators" }
  | { page: "permissions" }
  | { page: "accept-invite"; token: string };

function parseHash(hash: string): Route {
  // Split hash into path and query string: #/some/path?key=val
  const withoutHash = hash.replace(/^#/, "");
  const [pathPart, queryPart] = withoutHash.split("?");
  const params = new URLSearchParams(queryPart ?? "");
  const parts = pathPart.split("/").filter(Boolean);

  if (parts.length === 0) return { page: "landing" };

  if (parts[0] === "collections") {
    if (parts[1] && parts[2]) {
      const tab = params.get("tab");
      return {
        page: "document",
        collection: parts[1],
        id: parts[2],
        tab: (tab === "history" || tab === "paths") ? tab : "data",
      };
    }
    if (parts[1]) {
      const tab = params.get("tab");
      return {
        page: "collection",
        name: parts[1],
        tab: tab === "schema" ? "schema" : tab === "access" ? "access" : "documents",
      };
    }
  }

  if (parts[0] === "tree") {
    const treeName = parts[1] ?? "main";
    const treePath = "/" + parts.slice(2).join("/");
    const view = params.get("view");
    return {
      page: "tree",
      treeName,
      path: treePath || "/",
      view: view === "full" ? "full" : "browse",
    };
  }

  if (parts[0] === "settings" && parts[1] === "api-keys") return { page: "apikeys" };
  if (parts[0] === "settings" && parts[1] === "components") return { page: "components" };
  if (parts[0] === "settings" && parts[1] === "collaborators") return { page: "collaborators" };
  if (parts[0] === "settings" && parts[1] === "permissions") return { page: "permissions" };

  if (parts[0] === "invites" && parts[1] === "accept") {
    const token = params.get("token") ?? "";
    return { page: "accept-invite", token };
  }

  return { page: "landing" };
}

export function buildHash(route: Route): string {
  if (route.page === "landing") return "#/";
  if (route.page === "collection") {
    const base = `#/collections/${route.name}`;
    if (route.tab === "schema") return `${base}?tab=schema`;
    if (route.tab === "access") return `${base}?tab=access`;
    return base;
  }
  if (route.page === "document") {
    const base = `#/collections/${route.collection}/${route.id}`;
    if (route.tab === "history") return `${base}?tab=history`;
    if (route.tab === "paths")   return `${base}?tab=paths`;
    return base;
  }
  if (route.page === "tree") {
    const base = `#/tree/${route.treeName}${route.path}`;
    return route.view === "full" ? `${base}?view=full` : base;
  }
  if (route.page === "apikeys") return "#/settings/api-keys";
  if (route.page === "components") return "#/settings/components";
  if (route.page === "collaborators") return "#/settings/collaborators";
  if (route.page === "permissions") return "#/settings/permissions";
  if (route.page === "accept-invite") return `#/invites/accept?token=${route.token}`;
  return "#/";
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    getSession()
      .then((session) => { setUser(session?.user ?? null); })
      .catch(() => setUser(null))
      .finally(() => setSessionChecked(true));
  }, []);

  useEffect(() => {
    function onHashChange() {
      setRoute(parseHash(window.location.hash));
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  async function handleSignOut() {
    try {
      await signOut();
    } catch {
      // ignore
    }
    setUser(null);
    window.location.hash = "#/";
  }

  if (!sessionChecked) {
    return null;
  }

  if (!user) {
    return <LoginPage onLogin={(u) => setUser(u)} />;
  }

  function renderPage() {
    if (!user) return null;
    if (route.page === "document") {
      return (
        <DocumentPage
          collection={route.collection}
          id={route.id}
          tab={route.tab}
          user={user}
        />
      );
    }
    if (route.page === "collection") return <CollectionPage collection={route.name} tab={route.tab} user={user} />;
    if (route.page === "tree") return <TreePage treeName={route.treeName} path={route.path} view={route.view} user={user} />;
    if (route.page === "apikeys") return <ApiKeysPage />;
    if (route.page === "components") return <ComponentsPage />;
    if (route.page === "collaborators") return <CollaboratorsPage />;
    if (route.page === "permissions")   return <PermissionsPage />;
    if (route.page === "accept-invite") return <AcceptInvitePage token={route.token} />;
    return <CollectionPage collection={null} user={user} />;
  }

  const activeCollection =
    route.page === "collection" ? route.name :
    route.page === "document" ? route.collection :
    null;
  const activeSection: "collections" | "tree" | "settings" =
    route.page === "tree" ? "tree" :
    (route.page === "apikeys" || route.page === "components" || route.page === "collaborators" || route.page === "permissions") ? "settings" :
    "collections";

  return (
    <Layout user={user} onSignOut={handleSignOut} activeCollection={activeCollection} activeSection={activeSection}>
      {renderPage()}
    </Layout>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
