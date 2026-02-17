# Issues & Gotchas

This file documents problems encountered and their solutions.

---

## Task 1.1: Tauri 2.0 + Svelte + TypeScript Scaffold

### Issues Encountered & Resolved

1. **Tauri CLI not installed globally**
   - Solution: `npm install -g @tauri-apps/cli@latest` (installed 2.10.0)

2. **`tauri create` command doesn't exist**
   - Tauri 2.10.0 doesn't have `create` subcommand
   - Solution: Manually created project structure instead of using scaffolder

3. **Rust version incompatibility (1.86.0 vs 1.88.0)**
   - `time` crate v0.3.47 requires Rust 1.88.0+
   - Solution: `rustup update` → upgraded to 1.93.1

4. **Invalid `tauri.conf.json` configuration**
   - Initially placed `identifier` in bundle section (wrong)
   - Solution: Moved to top-level config object

5. **Missing `frontendDist` directory**
   - Tauri macro validates path exists at compile time
   - Solution: Created `dist/` directory before cargo check

6. **Missing icon files**
   - Tauri requires valid PNG/ICO/ICNS files referenced in config
   - Solution: Created minimal 1x1 transparent PNG files for scaffold

7. **TypeScript not recognized in Svelte components**
   - `lang="ts"` in `<script>` tag failed without preprocessor
   - Solution: Installed `svelte-preprocess` and configured in `vite.config.ts`

8. **Missing `verbatimModuleSyntax` in tsconfig.json**
   - Svelte + TypeScript requires this flag
   - Solution: Added `"verbatimModuleSyntax": true` to compiler options

### Unresolved

- None at this stage. All blockers resolved.

