/**
 * Ambient `*.css` module declaration for the package's STANDALONE typecheck
 * (the package has no `vite/client` types). This file is intentionally NOT
 * referenced (`/// <reference>`) or imported anywhere, so it is never pulled
 * into a consumer's TypeScript program — that keeps it from clashing with the
 * consumer's own `vite/client` `*.css` declaration.
 */
declare module '*.css';
