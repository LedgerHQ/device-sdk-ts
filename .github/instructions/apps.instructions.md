---
applyTo: "apps/**"
---

# Apps (`apps/*`)

These are private apps, not published libraries:

- `sample`: the Next.js playground
- `docs`: the developer portal content
- `mobile`
- `ldmk-cli`
- `device-mock-server` / `device-mock-server-ui`
- `clear-signing-tester`
- `devtools`

## Differences from the packages

- **No changeset needed.** Changesets only cover published packages.
- **Runtime globals:**
  - `sample` and `device-mock-server-ui` use `webRuntimeOverrides`, so Web globals and `process.env` are allowed.
  - `ldmk-cli`, `device-mock-server` and `clear-signing-tester` use `nodeRuntimeOverrides`, so Node APIs are allowed.
  - `devtools`, `docs` and `mobile` keep the default portable rules.
- **Exports:** default exports are fine where a framework requires them (Next.js `page.tsx` / `layout.tsx`, config files).
- **Public API rules don't apply:** there is no api/internal boundary.

## Review focus

- The apps must use the DMK and the signers through their **public** package exports, never deep imports into `lib/` or `src/internal/`. The sample app is the reference integration for external developers.
- `apps/docs`: code samples must match the current public API (method names, builder options).
- React: hooks rules, cleanup of DMK subscriptions (`unsubscribe` in effect cleanups), no leaked device sessions.

## Do not flag

- UI styling choices, copy text, or the playground's demo-only shortcuts.
- Missing unit or e2e tests: tests are optional in apps.
- Input validation, `localStorage` robustness and edge cases in the sample and mock-server UIs: they are developer tools. Only flag a bug on the normal path.
