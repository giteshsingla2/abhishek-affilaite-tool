'use strict';

/**
 * sitePath.js — shared helper for all custom_domain path and URL operations.
 *
 * Every place that touches the filesystem for a custom_domain site MUST use
 * these helpers instead of hand-rolling path.join() calls.  This guarantees:
 *   1. A single source of truth for the _root sentinel folder name.
 *   2. A path-traversal security check (resolves + prefix asserts) that runs
 *      at every call site automatically.
 *   3. Clean URL generation that matches the physical layout.
 *   4. An <base href> injector so subdirectory-mode sites resolve assets
 *      relative to their own sub-path rather than the apex domain root.
 */

const path = require('path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Absolute base directory where per-domain site trees live. */
const USER_SITES_BASE_DIR =
  process.env.USER_SITES_BASE_DIR || '/var/www/user_sites';

/**
 * Sentinel folder name that separates subdirectory-mode sites from
 * subdomain-mode sites inside the same domain folder.
 *
 *   /var/www/user_sites/{domain}/{slug}/          <- subdomain mode
 *   /var/www/user_sites/{domain}/_root/{slug}/    <- subdirectory mode
 *
 * Without it, `offer1` in both modes would map to the same physical path.
 */
const ROOT_FOLDER_NAME = '_root';

/** Ordered list of valid deploy modes. First entry is the default. */
const DEPLOY_MODES = ['subdomain', 'subdirectory'];

// ---------------------------------------------------------------------------
// Mode normalisation
// ---------------------------------------------------------------------------

/**
 * Returns `mode` if it is a recognised deploy mode, otherwise returns the
 * default ('subdomain').  Never throws — callers that receive an unexpected
 * mode value simply fall back safely.
 *
 * @param {string|undefined} mode
 * @returns {'subdomain'|'subdirectory'}
 */
function normaliseDeployMode(mode) {
  return DEPLOY_MODES.includes(mode) ? mode : DEPLOY_MODES[0];
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * DNS label charset regex (RFC 1123).
 * A valid label: starts and ends with [a-z0-9], may contain hyphens in between,
 * total length 1-63 characters.
 *
 * We use this for BOTH modes so a slug remains valid if the user switches
 * deploy mode later (DNS is the stricter constraint).
 */
const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Validates and normalises a raw slug value (the `sub_domain` CSV column).
 *
 * Never throws.  Returns `{ ok, slug, reason }`:
 *   - ok:true  => `slug` is the trimmed+lowercased value, ready to use
 *   - ok:false => `reason` is a human-readable string suitable for
 *                 campaign.failedRows
 *
 * @param {string|undefined|null} rawSlug
 * @returns {{ ok: boolean, slug: string, reason: string }}
 */
function validateSlug(rawSlug) {
  const slug = String(rawSlug ?? '').trim().toLowerCase();

  if (!slug) {
    return { ok: false, slug, reason: 'Missing sub_domain field' };
  }

  if (slug === ROOT_FOLDER_NAME) {
    return {
      ok: false,
      slug,
      reason: `"${slug}" is a reserved name and cannot be used as a slug`,
    };
  }

  if (!SLUG_RE.test(slug)) {
    return {
      ok: false,
      slug,
      reason:
        `"${slug}" is not a valid slug. ` +
        'Slugs must be 1-63 characters, consist of lowercase letters, digits, ' +
        'and hyphens, and must start and end with a letter or digit.',
    };
  }

  return { ok: true, slug, reason: '' };
}

/**
 * Validates and normalises a raw domain name.
 *
 * Never throws.  Returns `{ ok, domain, reason }` with the same shape as
 * validateSlug.  Accepts fully-qualified domain names like `example.com` or
 * `sub.example.co.uk`.
 *
 * @param {string|undefined|null} rawDomain
 * @returns {{ ok: boolean, domain: string, reason: string }}
 */
function validateDomain(rawDomain) {
  const domain = String(rawDomain ?? '').trim().toLowerCase();

  if (!domain) {
    return { ok: false, domain, reason: 'Missing domain name' };
  }

  /**
   * Pattern: one or more DNS labels each followed by a dot, then a final
   * label with at least 2 characters (TLD must be at least 2 chars).
   * Each label: starts/ends with [a-z0-9], may contain hyphens, max 63 chars.
   */
  const DOMAIN_RE =
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/;

  if (!DOMAIN_RE.test(domain)) {
    return {
      ok: false,
      domain,
      reason:
        `"${domain}" is not a valid domain name. ` +
        'Must be a fully-qualified domain such as "example.com".',
    };
  }

  return { ok: true, domain, reason: '' };
}

// ---------------------------------------------------------------------------
// Path builders
// ---------------------------------------------------------------------------

/**
 * Builds and returns the absolute directory path for a site on disk.
 *
 * THROWS on invalid or unsafe input -- callers here want a hard stop so that
 * a bad CSV row never silently writes to an unexpected location.
 *
 * Security:  After constructing the path the function resolves it and
 * verifies it is strictly inside USER_SITES_BASE_DIR.  This prevents a CSV
 * row like `sub_domain: ../../etc/passwd` from escaping the base directory.
 * It also blocks an empty slug that would resolve to the domain root and make
 * a recursive `fs.rmSync` wipe an entire domain folder.
 *
 * @param {{ domain: string, slug: string, deployMode?: string }} args
 * @returns {string} Absolute directory path -- the folder that contains index.html
 * @throws {Error} on invalid input or path-traversal attempt
 */
function buildSitePath({ domain, slug, deployMode }) {
  if (!domain) throw new Error('buildSitePath: domain is required');
  if (!slug) throw new Error('buildSitePath: slug is required');

  // Reject the sentinel folder name — using it as a slug would cause
  // subdirectory-mode paths to silently alias the _root directory itself.
  if (slug === ROOT_FOLDER_NAME) {
    throw new Error(
      `buildSitePath: "${ROOT_FOLDER_NAME}" is a reserved slug name.`
    );
  }

  const mode = normaliseDeployMode(deployMode);
  const base = USER_SITES_BASE_DIR;

  let sitePath;
  if (mode === 'subdirectory') {
    sitePath = path.join(base, domain, ROOT_FOLDER_NAME, slug);
  } else {
    // 'subdomain' (default)
    sitePath = path.join(base, domain, slug);
  }

  // --- Security: path-traversal guard ---
  const resolvedBase = path.resolve(base);
  const resolvedSite = path.resolve(sitePath);

  // Must be strictly inside (not equal to) the base dir.
  const expectedPrefix = resolvedBase + path.sep;
  if (!resolvedSite.startsWith(expectedPrefix)) {
    throw new Error(
      `Path traversal detected: resolved path "${resolvedSite}" is not ` +
        `inside base directory "${resolvedBase}". ` +
        `Offending inputs -- domain: "${domain}", slug: "${slug}".`
    );
  }

  // Must not equal the base directory itself (extra guard for empty inputs
  // that slip through the checks above on unusual platforms).
  if (resolvedSite === resolvedBase) {
    throw new Error(
      `Computed site path equals base directory "${resolvedBase}". ` +
        `Refusing to operate on the root of user_sites.`
    );
  }

  return resolvedSite;
}

/**
 * Returns the absolute path to the `index.html` file for a site.
 *
 * Delegates all validation and security checks to buildSitePath.
 *
 * @param {{ domain: string, slug: string, deployMode?: string }} args
 * @returns {string}
 */
function buildIndexPath(args) {
  return path.join(buildSitePath(args), 'index.html');
}

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

/**
 * Returns the public URL at which the site will be reachable.
 *
 *   subdomain    -> http://{slug}.{domain}
 *   subdirectory -> http://{domain}/{slug}/   (trailing slash kept)
 *
 * @param {{ domain: string, slug: string, deployMode?: string }} args
 * @returns {string}
 */
function buildSiteUrl({ domain, slug, deployMode }) {
  const mode = normaliseDeployMode(deployMode);
  if (mode === 'subdirectory') {
    return `http://${domain}/${slug}/`;
  }
  return `http://${slug}.${domain}`;
}

// ---------------------------------------------------------------------------
// HTML <base href> injector
// ---------------------------------------------------------------------------

/**
 * Inserts a `<base href="/{slug}/">` tag into `html` so that root-absolute
 * URLs emitted by the LLM (e.g. `/style.css`, `href="/"`) resolve relative
 * to the site's own subdirectory rather than the apex domain.
 *
 * Rules:
 *   - Returns html unchanged when deployMode is 'subdomain'.
 *   - Returns html unchanged when html is falsy/empty.
 *   - Returns html unchanged when the document already contains a <base> tag
 *     (avoids double-injection on redeploy).
 *   - Otherwise inserts `<base href="/{slug}/">` immediately after the
 *     opening <head> tag.
 *   - If no <head> tag is present, prepends the tag to the document.
 *
 * @param {string} html
 * @param {{ slug: string, deployMode?: string }} options
 * @returns {string}
 */
function injectBaseHref(html, { slug, deployMode } = {}) {
  const mode = normaliseDeployMode(deployMode);

  // No-op in subdomain mode
  if (mode !== 'subdirectory') return html;

  // No-op on empty content
  if (!html) return html;

  // No-op if a <base> tag already exists
  if (/<base\b/i.test(html)) return html;

  const baseTag = `<base href="/${slug}/">`;

  // Insert immediately after opening <head ...> tag
  const headOpenRe = /<head[^>]*>/i;
  const headMatch = headOpenRe.exec(html);
  if (headMatch) {
    const insertAt = headMatch.index + headMatch[0].length;
    return html.slice(0, insertAt) + baseTag + html.slice(insertAt);
  }

  // No <head> tag found -- prepend to the document
  return baseTag + html;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  USER_SITES_BASE_DIR,
  ROOT_FOLDER_NAME,
  DEPLOY_MODES,
  normaliseDeployMode,
  validateSlug,
  validateDomain,
  buildSitePath,
  buildIndexPath,
  buildSiteUrl,
  injectBaseHref,
};
