import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "componentlibrary/styles";
import "./app.css";
import { getSession, signOut, type User } from "./api";
import { Layout } from "./layout";
import { LoginPage } from "./pages/LoginPage";
import { CollectionPage } from "./pages/CollectionPage";
import { DocumentPage } from "./pages/DocumentPage";

type Route =
  | { page: "landing" }
  | { page: "collection"; name: string }
  | { page: "document"; collection: string; id: string };

function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, "");
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return { page: "landing" };
  if (parts[0] === "collections") {
    if (parts[1] && parts[2]) {
      return { page: "document", collection: parts[1], id: parts[2] };
    }
    if (parts[1]) {
      return { page: "collection", name: parts[1] };
    }
  }
  return { page: "landing" };
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  const [collectionInput, setCollectionInput] = useState("");

  useEffect(() => {
    getSession()
      .then((session) => {
        setUser(session?.user ?? null);
      })
      .catch(() => setUser(null))
      .finally(() => setSessionChecked(true));
  }, []);

  useEffect(() => {
    function onHashChange() {
      const r = parseHash(window.location.hash);
      setRoute(r);
      if (r.page === "collection") setCollectionInput(r.name);
      if (r.page === "document") setCollectionInput(r.collection);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Sync collectionInput with route on initial load
  useEffect(() => {
    if (route.page === "collection") setCollectionInput(route.name);
    if (route.page === "document") setCollectionInput(route.collection);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          user={user}
        />
      );
    }
    if (route.page === "collection") {
      return <CollectionPage collection={route.name} user={user} />;
    }
    return <CollectionPage collection={null} user={user} />;
  }

  return (
    <Layout
      user={user}
      onSignOut={handleSignOut}
      collectionInput={collectionInput}
      onCollectionInput={setCollectionInput}
    >
      {renderPage()}
    </Layout>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
