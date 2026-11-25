import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { ignores: ["node_modules/", "dist/", "supabase/"] },
  {
    // The page's code: TypeScript ES modules, served and bundled by Vite.
    files: ["src/**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
    },
    rules: {
      // `// @ts-nocheck` is only allowed with a reason after it.
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-nocheck": "allow-with-description" }],
    },
    // @typescript-eslint/no-unused-vars stays at its default on purpose: a
    // function that is only called from an inline on*="..." handler is "used"
    // solely through the window bridge at the bottom of src/main.ts, so leaving
    // it out of the bridge shows up here as an unused function.
  },
  {
    // main.ts is still `// @ts-nocheck`, so TypeScript doesn't report undefined
    // names in it, and typescript-eslint switches ESLint's no-undef off for .ts
    // files (TypeScript normally covers it). Turn it back on for this file until
    // it's typed.
    files: ["src/main.ts"],
    rules: { "no-undef": "error" },
  },
]);
