import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: Number(process.env.PORT) || 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
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
          if (!id.includes("node_modules")) return;
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
