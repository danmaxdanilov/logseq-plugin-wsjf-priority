import { defineConfig } from "vite";
import logseqDevPlugin from "vite-plugin-logseq";

// Use export default instead of defineConfig directly
export default defineConfig({
  plugins: [logseqDevPlugin()],
  build: {
    target: "esnext",
    minify: "esbuild",
  },
});
