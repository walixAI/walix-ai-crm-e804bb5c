import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "supabase/functions/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "npm:@supabase/supabase-js@2/cors": "@supabase/supabase-js/cors",
      "npm:@supabase/supabase-js@2": "@supabase/supabase-js",
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
