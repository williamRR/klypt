import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  build: { outDir: "dist" },
  envDir: "..",  // Share .env with root project
});
