import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { ignores: ["node_modules/", "supabase/"] },
  {
    // The page's code: a classic <script src>, not an ES module.
    files: ["js/**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: globals.browser,
    },
    rules: {
      // Top-level functions are called from inline onclick="..." handlers in
      // index.html and in template strings, which ESLint can't see. Only report
      // unused variables inside functions.
      "no-unused-vars": ["error", { vars: "local" }],
    },
  },
]);
