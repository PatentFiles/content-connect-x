# Restore original public homepages

## Public homepage styling boundary — November 18, 2026

The logged-out Content Connect X and Host Connect pages retain their original dark/neon branding, original hero artwork, gradients and responsive layout. The professional white redesign applies **after sign-in**, including member, administrator, verification and host workspaces. Do not replace public artwork or apply workspace CSS globally.

The public skin is restored from commit `21b95435a02e9e1e6ddc10e8805f377bf4b9a67d`. `authAppearance.js` follows the actual Auth session and changes presentation only. Every theme selector is scoped to either public or non-public appearance, with original specificity preserved via `:where()`. This cannot grant admission or bypass any backend rule. Signing out restores public styling and clears the Host workspace display.

Regression tests verify all three original asset hashes, every CSS scope, real image decoding at mobile/desktop sizes, and real component sign-in/sign-out transitions using isolated Auth fixtures. Existing white-workspace/modal, identity and account-access tests remain in place. Bolt is still the website host; no Supabase or Railway deployment is needed for this presentation fix.

