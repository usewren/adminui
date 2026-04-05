import index from "./index.html";

Bun.serve({
  port: 4002,
  routes: {
    "/": index,
    "/*": index,  // SPA fallback
  },
  development: process.env.NODE_ENV !== "production" ? { hmr: true, console: true } : undefined,
});

console.log("Wren Admin UI at http://localhost:4002");
