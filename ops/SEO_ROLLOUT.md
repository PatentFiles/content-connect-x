# contentconnectx.com: search discovery and AI visibility rollout

This file tracks infrastructure implemented in the GitHub repository and the
operator-only steps needed after publishing. The repo never stores Google,
Bing, IndexNow, Search Console, Analytics, or OpenSEO credentials.

## Completed in source control

- Public `index.html` includes a descriptive title, description, canonical
  homepage URL, Open Graph/Twitter preview information, and Organization/WebSite
  JSON-LD using verified local artwork. No ownership or contact fields are invented.
- The initial HTML includes a readable public marketing fallback when JavaScript
  is not executed. The existing React application replaces it during startup.
- `public/robots.txt` declares the public sitemap and excludes common private
  account, verification and operations paths. **Robots rules do not secure
  private information.** Supabase authorization and RLS remain mandatory.
- `public/sitemap.xml` includes exactly the homepage and three distinct,
  non-sensitive, crawlable static guides:
  - https://contentconnectx.com/creator-collaboration/
  - https://contentconnectx.com/production-professionals/
  - https://contentconnectx.com/how-it-works/
- Public guide pages include canonical URLs, unique descriptive metadata,
  social previews, navigation, WebPage JSON-LD, and substantive HTML copy
  without authentication or JavaScript.
- The existing website footer links to the guides. The sister site
  https://hostconnectx.com/ remains independently hosted.
- Browser-level route handling removes the homepage index directive from
  non-home SPA routes. Member-only paths are not submitted in the sitemap.
- Automated tests validate the SEO assets, URL boundaries and metadata.

## Important: production deployment and DNS

The latest GitHub code does not change public DNS or publish Bolt automatically.
Deploy the latest `main` from this repository in the correct Bolt project,
then confirm that `https://contentconnectx.com/` serves THAT build, rather than an
old website or a previous hosting provider. Do not change DNS blindly.

Check these URLs in a normal unauthenticated browser:

- https://contentconnectx.com/
- https://contentconnectx.com/robots.txt  (Content-Type text/plain)
- https://contentconnectx.com/sitemap.xml (Content-Type application/xml or text/xml)
- https://contentconnectx.com/creator-collaboration/ (HTTP 200, unique title and full HTML)
- https://contentconnectx.com/production-professionals/ (HTTP 200, unique title and full HTML)
- https://contentconnectx.com/how-it-works/ (HTTP 200, unique title and full HTML)

Ensure the HTTPS apex hostname is the preferred domain, with any www variant
redirecting permanently to the apex if a www hostname exists. Avoid
redirect chains and alternate public staging sites being indexed.
Bolt or its hosting provider controls redirects and response headers.

## Future domain-owned account setup (requires operator action)

1. Provision and secure a REAL business mailbox, such as
   `info@contentconnectx.com`. Do not publish or claim it as a functioning mailbox
   before MX records and delivery have been tested. Enable MFA.
2. Sign in to **Google Search Console** with a business-controlled
   Google identity. Verify the `contentconnectx.com` domain property using
   Google's DNS TXT challenge. Only a verified owner should configure
   this; do NOT add a generic verification tag or a personal Gmail token.
3. Sign in to **Bing Webmaster Tools** under the same business-controlled
   ownership arrangement. Verify the domain; optionally import a verified
   Search Console property when appropriate.
4. Submit `https://contentconnectx.com/sitemap.xml` to both tools, then
   inspect the homepage and each public guide. Check canonical, robots,
   mobile indexing, structured data, Core Web Vitals and coverage.
5. Create a separate, domain-scoped **OpenSEO project** only after deciding
   which business identity will own/operate its Google Search Console
   connection. Never silently link a personal Google account to the domain.
6. Optionally configure a privacy-respecting analytics property using
   appropriate consent, data retention and jurisdictional policies.
   Keep separate analytics and Search Console properties for each site.
7. Configure an IndexNow key only after the business domain ownership
   and key-file/public HTTPS serving are confirmed. Do not submit
   invented keys or URLs that are not live.
8. Keep the public pages helpful, truthful and current. Recheck the
   index and sitemap on each significant content release.

## Adult-industry and access boundaries

These platforms serve adult-industry professionals. Search providers can
apply SafeSearch, adult-content and regional policies even if pages are
technically eligible for indexing. Nothing here guarantees rankings,
AI citations, or an inclusion decision from a provider.

Never generate public sitemap entries or JSON-LD for private member profiles,
verification documents, explicit uploads, private property addresses,
invitations, messages, booking records, legal documents or admin portals.
This SEO change does not touch Supabase records, payment providers, identity
services, user permissions, or private media.

Search/AI bots use their current documented crawling behavior and applicable
robots rules. Public content, clear branding, stable URLs and legitimate
third-party citations are more useful than "AI visibility" meta tags that
search engines do not document or support.
