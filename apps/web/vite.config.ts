import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2022",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    maxWorkers: 1,
    fileParallelism: false,
    reporters: ["default", "junit"],
    outputFile: {
      junit: "../../.local/evidence/frontend-junit.xml",
    },
  },
});
