import tailwindTurbopackLoader from "@tailwindcss/turbopack";
import { transform, Features } from "lightningcss";

/**
 * Unwraps `@layer ... { ... }` and `@layer ...;` rules so browsers before
 * Chrome 99 (such as Samsung Tizen TV's Chromium 69) apply all Tailwind v4 styles.
 */
function unwrapAtLayer(css) {
  const pattern = /@layer\b[^{;]*([;{])/g;
  let result = "";
  let i = 0;
  let match;

  while (i < css.length) {
    pattern.lastIndex = i;
    match = pattern.exec(css);
    if (!match) {
      result += css.slice(i);
      break;
    }
    result += css.slice(i, match.index);
    if (match[1] === ";") {
      i = pattern.lastIndex;
      continue;
    }
    let depth = 1;
    let j = pattern.lastIndex;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    const inner = css.slice(pattern.lastIndex, j - 1);
    result += unwrapAtLayer(inner);
    i = j;
  }

  return result;
}

/**
 * Generates an `@supports not (inset: 0px)` fallback block for Flexbox `gap`
 * on pre-Chrome 84 browsers (Samsung Tizen TV runs Chromium 69, which supports
 * CSS Grid `gap` but not Flexbox `gap`). Modern browsers like Firestick's
 * Fully Kiosk Browser support `inset: 0px` and ignore this block completely.
 */
function buildLegacyFlexGapFallback(css) {
  const gapRuleRegex = /^\s*(\.gap-[^\s{]+)\s*\{\s*gap:\s*([^;]+);\s*\}/gm;
  const rules = [];
  let match;

  while ((match = gapRuleRegex.exec(css)) !== null) {
    const selector = match[1];
    const value = match[2].trim();
    rules.push(
      `.flex${selector}:not(.flex-col) > * + *:not([class*="ml-"]):not([class*="mx-"]):not(.m-auto),` +
        `.inline-flex${selector}:not(.flex-col) > * + *:not([class*="ml-"]):not([class*="mx-"]):not(.m-auto) { margin-left: ${value}; }`,
      `.flex.flex-col${selector} > * + *:not([class*="mt-"]):not([class*="my-"]):not(.m-auto),` +
        `.inline-flex.flex-col${selector} > * + *:not([class*="mt-"]):not([class*="my-"]):not(.m-auto) { margin-top: ${value}; }`
    );
  }

  if (rules.length === 0) return "";
  return `\n@supports not (inset: 0px) {\n  ${rules.join("\n  ")}\n}\n`;
}

function transformToLegacyCompatibleCss(source, filename) {
  // 1. Compile modern CSS (oklch, color-mix, logical properties, inset, etc.)
  // down to Chrome 69 (Samsung Tizen 5.5) while keeping @supports blocks for modern browsers.
  const res = transform({
    filename: filename || "globals.css",
    code: Buffer.from(source),
    minify: false,
    include:
      Features.Nesting |
      Features.MediaQueries |
      Features.LogicalProperties |
      Features.Colors,
    targets: {
      chrome: 69 << 16,
    },
    errorRecovery: true,
  });

  let out = res.code.toString();

  // 2. Unwrap all @layer blocks for pre-Chrome 99 compatibility
  out = unwrapAtLayer(out);

  // 3. Unwrap the @supports ((-webkit-hyphens: none) ...) guard around *, :before, :after
  // so browsers without @property (Chrome < 85) still initialize --tw-* variables.
  out = out.replace(
    /@supports\s*\(\(\(-webkit-hyphens:\s*none\)\)[\s\S]*?\{\s*(\*,\s*:before,\s*:after,\s*::backdrop\s*\{[\s\S]*?\})\s*\}/,
    "$1"
  );

  // 4. Replace :where(...) in base/utility selectors for Chrome < 88 compatibility
  out = out.replace(/:where\((\.space-[xy]-[^)]+)\)/g, "$1");
  out = out.replace(/abbr:where\(\[title\]\)/g, "abbr[title]");
  out = out.replace(
    /input:where\(\[type="button"\],\s*\[type="reset"\],\s*\[type="submit"\]\)/g,
    'input[type="button"], input[type="reset"], input[type="submit"]'
  );
  out = out.replace(
    /\[hidden\]:where\(:not\(\[hidden="until-found"\]\)\)/g,
    '[hidden]:not([hidden="until-found"])'
  );

  // 5. Append Flexbox gap fallback scoped strictly to pre-Chrome 87 browsers
  out += buildLegacyFlexGapFallback(out);

  return out;
}

export default function legacyCssLoader(source) {
  const realCallback = this.async();
  const resourcePath = this.resourcePath;

  const wrappedContext = Object.create(this, {
    async: {
      value: () => (err, compiledCss, map, meta) => {
        if (err) {
          realCallback(err);
          return;
        }
        try {
          const out =
            typeof compiledCss === "string"
              ? transformToLegacyCompatibleCss(compiledCss, resourcePath)
              : compiledCss;
          realCallback(null, out, map, meta);
        } catch (transformErr) {
          realCallback(transformErr);
        }
      },
    },
  });

  return tailwindTurbopackLoader.call(wrappedContext, source);
}
