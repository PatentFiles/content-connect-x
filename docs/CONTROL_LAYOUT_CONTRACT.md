# Shared control layout contract

## Scope

Content Connect X and Host Connect share `src/control-layout.css`, imported once by `src/index.css`. The contract applies inside ordinary pages and native modal dialogs; it does not depend on a particular account role or a successful data request. Consent values, handlers, authentication, provider configuration and database permissions are unchanged.

## Root cause and repair

The former global rule used `padding: 12px; margin: -12px` on native checkboxes and radios. In the actual Collaborations form the rendered checkbox became 26×26 pixels and escaped its label box, covering the adjacent text. The same rule affected 34 native choice locations across the source tree.

Native controls now occupy a real, non-shrinking 20px square with zero padding and no negative margin. The associated label provides a 44px minimum clickable row and positive text separation. Checked, disabled, keyboard-focus and native label-click behavior are preserved. Hidden/screen-reader-only controls remain hidden. High-contrast mode uses native control rendering.

Thirty-three ordinary action/composer rows now share `.ccx-action-row`. They wrap when their fields and actions no longer fit. Text captions and long card content can break rather than render outside their containers. Intentional carousels, calendar grids, segmented controls, overlays and navigation tabs are not converted into generic wrapping rows.

The modal text-field selector explicitly excludes checkbox, radio, range, file, hidden and button-like input types. Icon-only host controls now have square, in-flow touch targets rather than a small declared width conflicting with a larger global minimum height. Invisible negative-inset `.touch-target` overlays were removed.

The authenticated header also wraps at constrained widths or enlarged text. `OriginalShell` observes its actual height and shares it with content/sidebar offsets. This prevents the fixed header from covering the first content row. The sidebar is capped relative to viewport width at enlarged text sizes.

## Adding a new form

- Put a native checkbox or radio inside a real `<label>`. The global selector automatically gives it spacing and a usable click target; `.ccx-choice-row` is also available explicitly.
- Never add negative margins or padding to a checkbox/radio to enlarge its hit area. Enlarge the label instead.
- Use `.ccx-action-row` for ordinary multi-action rows and text-entry-plus-submit rows. Do not apply it to intentionally scrollable navigation or image controls.
- Use the brand action classes for buttons and allow long captions to wrap. Decorative icons must not replace accessible button labels.
- Do not use generic text-input skins for checkbox, radio, hidden, range or file inputs.

## Validation

The source inventory covers all 72 JSX modules and extracts all 34 native choice label locations, plus 33 updated action rows. `npm run test:control-layout` guards imports, control geometry, modal selectors, native semantics and source coverage.

`npm run test:ui-controls` runs Chromium via DevTools protocol without a session or production API calls. It generates fixtures from the source, renders the actual Collaborations component, and mounts the actual shared header/Collaborations React components against isolated empty network fixtures. It checks:

- 320px, 390px, 768px and 1440px widths;
- light/dark themes and normal/200% text for choice/action fixtures (16 layouts);
- real responsive header wrapping and measured content offsets at four widths and both text sizes (8 layouts);
- checkbox text intersection, control containment/size, action overlap, horizontal overflow, hidden/range controls, square icon controls;
- label-click, keyboard Space, disabled behavior and absence of runtime errors in the header fixture.

All 24 layouts passed locally. The full 111-test non-authenticated suite, lint, type-check, role rendering and production build are also checked. These are layout/component tests, not a claim that every authenticated production transaction was exercised. The independent dependency audit is not disabled or suppressed.

The browser runner requires Chromium/Chrome (`CHROME_BIN` can override its location) and Node 20.10+ with `--experimental-websocket` or Node 22+. `CONTROL_SCREENSHOT_DIR` optionally writes screenshots and JSON evidence. No new application dependency or Supabase change is required.

CSS reference: https://developer.mozilla.org/en-US/docs/Web/CSS/:has and https://developer.mozilla.org/en-US/docs/Web/CSS/:where
