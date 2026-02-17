# Learnings & Conventions

This file accumulates knowledge about the codebase patterns, naming conventions, and best practices discovered during implementation.

---

## Task 1.1: Tauri 2.0 + Svelte + TypeScript Scaffold

### Key Learnings

1. **Tauri 2.0 Configuration**
   - `identifier` field must be at top level of `tauri.conf.json`, not in bundle section
   - `frontendDist` path is validated at compile time via `tauri::generate_context!()` macro
   - Icon files must exist and be valid PNG/ICO/ICNS files (created minimal 1x1 PNGs for scaffold)

2. **Rust Version Compatibility**
   - Tauri 2.10.2 requires Rust 1.88.0+ due to `time` crate dependency
   - Updated from Rust 1.86.0 to 1.93.1 via `rustup update`
   - Removed `shell-open` feature from Tauri 2.0 (doesn't exist in this version)

3. **Svelte + TypeScript Setup**
   - Must install `svelte-preprocess` as dev dependency for TypeScript support in `.svelte` files
   - Vite config must explicitly pass `preprocess: sveltePreprocess()` to svelte plugin
   - `tsconfig.json` requires `verbatimModuleSyntax: true` when using TypeScript in Svelte

4. **Project Structure**
   - Frontend: `src/` (Svelte components, TypeScript)
   - Backend: `src-tauri/` (Rust, Cargo.toml)
   - Build output: `dist/` (Vite builds here, Tauri references it)
   - Config: `vite.config.ts`, `tsconfig.json`, `src-tauri/tauri.conf.json`

5. **Build Process**
   - Frontend: `npm run build` → Vite bundles to `dist/`
   - Backend: `cargo check` validates Rust code
   - Dev: `npm run tauri:dev` runs both frontend dev server and Tauri app

### Conventions Established

- Package name: `ai-command-center` (kebab-case)
- Identifier: `com.opencode.ai-command-center` (reverse domain notation)
- Frontend entry: `src/main.ts` → mounts `App.svelte` to `#app` div
- Tauri entry: `src-tauri/src/main.rs` → minimal boilerplate with `tauri::generate_context!()`

