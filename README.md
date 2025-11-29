# Vibe

Vibe is the early scaffold for a full-stack, vibe-forward coding platform: Solid + Tailwind UI in `apps/web`, Bun + Elysia API in `apps/server`, and shared packages (`packages/fs`, `packages/code-editor`, `packages/ui`, `packages/eslint-config`, `packages/typescript-config`) wired together with Turborepo.

## Quick start

```bash
# install (uses bun workspaces)
bun install

# run everything in dev mode
bun run dev

# focus a single app
bun run dev --filter=web     # Solid frontend (Vite)
bun run dev --filter=server  # Bun/Elysia API
```

## Build & lint

```bash
bun run build   # turbo build all
bun run lint    # eslint across packages
```

## Notes

- Target Node/Bun 18+.
- Source of truth lives in `apps/web/src` and `packages/fs` for the virtual filesystem building blocks; server endpoints are in `apps/server/src`.
- This README stays short on purpose—treat this repo as a playground while the platform takes shape.

