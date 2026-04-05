import React, { useState } from "react";
import {
  Button, Badge, Card, Spinner, Tabs, Input,
  EmptyState, Table,
} from "componentlibrary";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, paddingBottom: 8, borderBottom: "1px solid var(--wren-border)", color: "var(--wren-text)" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({ children, gap = 8 }: { children: React.ReactNode; gap?: number }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap, alignItems: "center", marginBottom: 12 }}>{children}</div>;
}

function PropTable({ rows }: { rows: [string, string, string, string][] }) {
  return (
    <table className="wren-table" style={{ marginTop: 12, fontSize: 12 }}>
      <thead>
        <tr><th>Prop</th><th>Type</th><th>Default</th><th>Description</th></tr>
      </thead>
      <tbody>
        {rows.map(([prop, type, def, desc]) => (
          <tr key={prop}>
            <td><code style={{ fontFamily: "var(--wren-mono)" }}>{prop}</code></td>
            <td><code style={{ fontFamily: "var(--wren-mono)", color: "var(--wren-primary)" }}>{type}</code></td>
            <td><code style={{ fontFamily: "var(--wren-mono)", color: "var(--wren-text-muted)" }}>{def}</code></td>
            <td style={{ color: "var(--wren-text-muted)" }}>{desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ComponentsPage() {
  const [activeTab, setActiveTab] = useState("one");
  const [inputVal, setInputVal] = useState("");
  const [inputErr, setInputErr] = useState("");

  return (
    <div>
      <div className="admin-main__header">
        <h1 className="admin-page-title">Component Library</h1>
      </div>

      {/* Button */}
      <Section title="Button">
        <Card>
          <p style={{ fontSize: 13, color: "var(--wren-text-muted)", marginBottom: 16 }}>
            General-purpose button. Supports four variants, three sizes, and a loading state.
          </p>
          <Row>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="ghost">Ghost</Button>
          </Row>
          <Row>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </Row>
          <Row>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
          </Row>
          <PropTable rows={[
            ["variant", "'primary' | 'secondary' | 'danger' | 'ghost'", "'primary'", "Visual style"],
            ["size", "'sm' | 'md' | 'lg'", "'md'", "Size preset"],
            ["loading", "boolean", "false", "Shows spinner, disables button"],
            ["disabled", "boolean", "false", "Disables the button"],
          ]} />
        </Card>
      </Section>

      {/* Badge */}
      <Section title="Badge">
        <Card>
          <p style={{ fontSize: 13, color: "var(--wren-text-muted)", marginBottom: 16 }}>
            Inline status label. Auto-assigns variant based on common label names (published → green, draft → amber).
          </p>
          <Row>
            <Badge label="published" />
            <Badge label="draft" />
            <Badge label="archived" />
            <Badge label="v3" variant="blue" />
            <Badge label="error" variant="red" />
            <Badge label="custom" variant="default" />
          </Row>
          <PropTable rows={[
            ["label", "string", "—", "Text displayed inside the badge"],
            ["variant", "'default' | 'green' | 'amber' | 'red' | 'blue'", "auto", "Colour. Auto-assigned from label if omitted"],
          ]} />
        </Card>
      </Section>

      {/* Card */}
      <Section title="Card">
        <Card>
          <p style={{ fontSize: 13, color: "var(--wren-text-muted)", marginBottom: 16 }}>
            Container with optional header. Used as the primary content block across all admin pages.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Card title="With title">Card body content goes here.</Card>
            <Card>Without title — just body.</Card>
          </div>
          <PropTable rows={[
            ["title", "string", "—", "Optional header text"],
            ["children", "ReactNode", "—", "Card body"],
            ["className", "string", "—", "Extra CSS class"],
          ]} />
        </Card>
      </Section>

      {/* Spinner */}
      <Section title="Spinner">
        <Card>
          <p style={{ fontSize: 13, color: "var(--wren-text-muted)", marginBottom: 16 }}>
            Loading indicator in three sizes.
          </p>
          <Row gap={24}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <Spinner size="sm" /> sm
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <Spinner size="md" /> md
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <Spinner size="lg" /> lg
            </span>
          </Row>
          <PropTable rows={[
            ["size", "'sm' | 'md' | 'lg'", "'md'", "Size of the spinner"],
          ]} />
        </Card>
      </Section>

      {/* Tabs */}
      <Section title="Tabs">
        <Card>
          <p style={{ fontSize: 13, color: "var(--wren-text-muted)", marginBottom: 16 }}>
            Horizontal tab bar. Controlled — pass <code style={{ fontFamily: "var(--wren-mono)", fontSize: 12 }}>active</code> and handle <code style={{ fontFamily: "var(--wren-mono)", fontSize: 12 }}>onChange</code>.
          </p>
          <Tabs
            tabs={[{ key: "one", label: "First tab" }, { key: "two", label: "Second tab" }, { key: "three", label: "Third tab" }]}
            active={activeTab}
            onChange={setActiveTab}
          />
          <div style={{ marginTop: 12, padding: "12px 0", fontSize: 13, color: "var(--wren-text-muted)" }}>
            Active: <strong>{activeTab}</strong>
          </div>
          <PropTable rows={[
            ["tabs", "{ key: string; label: string }[]", "—", "Tab definitions"],
            ["active", "string", "—", "Key of the active tab"],
            ["onChange", "(key: string) => void", "—", "Called when a tab is clicked"],
          ]} />
        </Card>
      </Section>

      {/* Input */}
      <Section title="Input">
        <Card>
          <p style={{ fontSize: 13, color: "var(--wren-text-muted)", marginBottom: 16 }}>
            Labelled text input with optional error state. Passes all native input props through.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 600 }}>
            <Input
              label="With label"
              placeholder="Type something…"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
            />
            <Input
              label="With error"
              value={inputErr}
              onChange={(e) => setInputErr(e.target.value)}
              error={inputErr.length > 0 && inputErr.length < 3 ? "Too short" : ""}
            />
            <Input placeholder="No label" />
            <Input label="Disabled" disabled value="Can't edit this" />
          </div>
          <PropTable rows={[
            ["label", "string", "—", "Label text rendered above the input"],
            ["error", "string", "—", "Error message shown below input (red border when set)"],
            ["id", "string", "—", "Overrides auto-generated id"],
          ]} />
        </Card>
      </Section>

      {/* EmptyState */}
      <Section title="EmptyState">
        <Card>
          <p style={{ fontSize: 13, color: "var(--wren-text-muted)", marginBottom: 16 }}>
            Placeholder for empty lists or missing content. Optionally includes a call-to-action.
          </p>
          <EmptyState
            title="No documents yet"
            description="Create your first document to get started."
            action={<Button size="sm">Create document</Button>}
          />
          <PropTable rows={[
            ["title", "string", "—", "Primary message"],
            ["description", "string", "—", "Secondary help text"],
            ["action", "ReactNode", "—", "Optional call-to-action element"],
          ]} />
        </Card>
      </Section>

      {/* Table */}
      <Section title="Table">
        <Card>
          <p style={{ fontSize: 13, color: "var(--wren-text-muted)", marginBottom: 16 }}>
            Generic data table. Pass column definitions and rows. Supports custom cell renderers and row click handlers.
          </p>
          <Table
            columns={[
              { key: "name", header: "Name" },
              { key: "status", header: "Status", render: (r) => <Badge label={r.status} /> },
              { key: "updated", header: "Updated" },
            ]}
            rows={[
              { name: "pages", status: "published", updated: "2026-04-05" },
              { name: "posts", status: "draft", updated: "2026-04-04" },
              { name: "authors", status: "archived", updated: "2026-03-10" },
            ]}
          />
          <PropTable rows={[
            ["columns", "Column<T>[]", "—", "{ key, header, render? } — render overrides default cell value"],
            ["rows", "T[]", "—", "Data rows"],
            ["onRowClick", "(row: T) => void", "—", "Makes rows clickable"],
            ["emptyMessage", "string", "'No data available.'", "Shown when rows is empty"],
          ]} />
        </Card>
      </Section>
    </div>
  );
}
