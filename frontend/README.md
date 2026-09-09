# Frontend Notes

## Scope

This directory contains the user interface, page routing, shared components, and client-side request logic.

## Main Areas

- `src/app/pages/`: page-level views
- `src/app/layouts/`: shell layout and navigation
- `src/app/components/`: reusable UI blocks
- `src/api/`: request wrappers and API helpers
- `src/styles/`: global styles

## Configuration

- Optional overrides are read from `frontend/.env`. Public OAuth client IDs default from `src/config/oauthPublicDefaults.ts` so clones work without creating `.env`.