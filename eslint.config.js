import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { ignores: ["node_modules/", "dist/", "supabase/"] },
  {
    // The page's code (TypeScript ES modules, served and bundled by Vite) and its
    // tests, which run in a browser-like jsdom environment. typescript-eslint's
    // recommended rules ban `any` and `// @ts-nocheck`.
    files: ["src/**/*.ts", "tests/**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
    },
  },
]);
