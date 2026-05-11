# BugPin Client Integrations

Drop-in compatibility shims for embedding the BugPin widget in
specific frontend stacks. Each file in this directory is a single,
self-contained `<script>` snippet you load **before** the BugPin
widget script.

## Available shims

| File | Use when… |
|------|-----------|
| [`vue3-compat.js`](./vue3-compat.js) | Embedding BugPin in a Vue 3 application (especially Vite + Ant Design Vue / Element Plus). Solves cross-origin image screenshot failures and Vue-proxy console-hook serialization crashes. |

## Usage

Serve the shim from your BugPin server (or any CDN / static host) and
reference it in your app's HTML **above** the widget script:

```html
<!-- 1. Load the shim first so it can prepare the DOM and wrap console. -->
<script src="https://your-bugpin-server.com/client-integrations/vue3-compat.js"></script>

<!-- 2. Then the BugPin widget. -->
<script src="https://your-bugpin-server.com/widget.js"
        data-api-key="proj_xxxxxxxx"></script>
```

Each shim is idempotent — loading it twice is a no-op. They are also
read-only at runtime (no module exports), so import order is the only
thing that matters.

## When NOT to use these shims

If your application has no cross-origin images and your frontend
framework doesn't wrap component instances in proxies, the upstream
widget will work without these shims. They are opt-in workarounds
for specific framework quirks.

## Contributing a new shim

1. Add `<framework>-compat.js` here.
2. Top of file: JSDoc block describing the issue, the fix, and the
   tested framework version range.
3. Wrap everything in a self-executing IIFE so loading it has no
   exports and no global side effects beyond a `window.__bugpin*`
   guard flag.
4. Add a row to the table above.
5. Open a PR.

## Provenance

These shims were extracted from
[mige-lims](https://github.com/wuzhiguocarter/mige-lims-jeecgboot)
(Vue 3 + Vite 6 + Ant Design Vue 4 + JeecgBoot 3.9) production usage
of BugPin self-hosted.
