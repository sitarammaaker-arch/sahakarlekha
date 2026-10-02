import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import type { Plugin } from "vite";
import { blogMdMeta } from "./src/content/blog/mdMeta";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: Number(process.env.PORT) || 8080,
  },
  plugins: [react(), blogMdMetaPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Split heavy, leaf-level vendor libs into their own cacheable chunks so
        // they load only when a page that needs them is opened (and are cached
        // across route navigations). Keeps the initial download small on mobile.
        manualChunks(id: string) {
          // J1: Vite's own preload helper (a virtual module, not under node_modules) must not land in a
          // feature chunk — it did ("pdf"), so the entry imported the whole jspdf bundle to reach it.
          if (id.includes("vite/preload-helper") || id.includes("commonjsHelpers")) return "helpers";
          if (!id.includes("node_modules")) return;
          // J1: React and tiny shared helpers get their OWN chunks. Left unassigned, Rollup hoisted React
          // and clsx into "charts" and a helper into "pdf", so EVERY page (landing, blog) modulepreloaded
          // the whole recharts + jspdf/html2canvas bundles (~400 KB gzip) it never uses.
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-is)[\\/]/.test(id)) return "react";
          if (/[\\/]node_modules[\\/](@babel[\\/]runtime|tslib|clsx|tailwind-merge|class-variance-authority)[\\/]/.test(id)) return "helpers";
          if (id.includes("jspdf") || id.includes("html2canvas") || id.includes("dompurify") || id.includes("canvg")) return "pdf";
          if (id.includes("recharts") || id.includes("/d3-") || id.includes("victory")) return "charts";
          if (id.includes("xlsx")) return "xlsx";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("react-router") || id.includes("@remix-run")) return "router";
        },
      },
    },
  },
}));

/** J2 · `./*.md?meta` → `export default { minutes, intro }` computed at build time from the markdown,
 *  so list pages import tiny metadata instead of every article body (see src/content/blog/mdMeta.ts). */
function blogMdMetaPlugin(): Plugin {
  return {
    name: "blog-md-meta",
    enforce: "pre",
    load(id) {
      if (!id.endsWith(".md?meta")) return null;
      const file = id.slice(0, -"?meta".length);
      return `export default ${JSON.stringify(blogMdMeta(fs.readFileSync(file, "utf8")))};`;
    },
  };
}
