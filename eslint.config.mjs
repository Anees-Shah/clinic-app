import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    // NOTE: unanchored (**/) — anchored patterns like ".next/**" miss nested
    // build caches (a stray clinic-app/.next once broke CI with 200+ errors).
    "**/.next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma client output — generated code, never lint it:
    "src/generated/**",
  ]),
]);

export default eslintConfig;
