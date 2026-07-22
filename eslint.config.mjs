import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      /*
       * These React Compiler rules are downgraded to warnings because the app
       * legitimately hits the patterns they forbid:
       *
       * - `set-state-in-effect`: LocalStorage can only be read after mount, so
       *   hydration necessarily flows "read external store → setState in an
       *   effect". Modal forms likewise reset their fields when `open` flips,
       *   which is a state sync the compiler cannot see is intentional.
       *
       * - `purity`: dashboard aggregates and date-range filters are computed
       *   from `Date.now()` inside `useMemo`. The value is deliberately "now at
       *   render time"; there is no prop to thread it through in an MVP with no
       *   server clock.
       *
       * Each is a conscious trade-off, not an oversight. Revisit if a future
       * version moves hydration to the server.
       */
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);

export default eslintConfig;
