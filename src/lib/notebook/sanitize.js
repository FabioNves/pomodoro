// Allow-list HTML sanitiser for notebook content. Runs in the browser both
// when a tab is loaded into the editor and before it is saved, so whatever
// reaches the DOM only ever contains the markup the editor itself produces.
// Unknown elements are unwrapped (their text survives); scripts, frames,
// media, forms and event handlers are dropped outright.

const ALLOWED_TAGS = new Set([
  "p", "br", "div", "span", "b", "strong", "i", "em", "u", "s", "strike", "del",
  "h1", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "pre", "code", "a",
  "hr", "sub", "sup", "font", "mark",
]);

const DROP_TAGS = new Set([
  "script", "style", "iframe", "object", "embed", "link", "meta", "base", "form",
  "input", "button", "textarea", "select", "option", "svg", "math", "template",
  "noscript", "video", "audio", "img", "picture", "source", "canvas", "head",
  "title",
]);

const ALLOWED_ATTRS = {
  a: ["href", "title"],
  ul: ["data-type"],
  ol: ["start"],
  li: ["data-checked"],
  font: ["color", "size"],
};

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|[a-z]+)$/i;
const STYLE_PROPS = {
  color: COLOR,
  "background-color": COLOR,
  "text-align": /^(left|center|right|justify)$/,
  "font-size": /^(xx-small|x-small|small|medium|large|x-large|xx-large|\d+(\.\d+)?(px|pt|em|rem|%))$/,
  "font-weight": /^(bold|bolder|normal|\d{3})$/,
  "font-style": /^(italic|normal)$/,
  "text-decoration": /^[a-z\s-]+$/,
  "text-decoration-line": /^[a-z\s-]+$/,
  "margin-left": /^\d+(\.\d+)?(px|em|rem)$/,
  "padding-left": /^\d+(\.\d+)?(px|em|rem)$/,
};

const SAFE_HREF = /^(https?:|mailto:|tel:|#)/i;

function filterStyle(value) {
  return String(value)
    .split(";")
    .map((declaration) => {
      const at = declaration.indexOf(":");
      if (at < 0) return null;
      const prop = declaration.slice(0, at).trim().toLowerCase();
      const val = declaration.slice(at + 1).trim();
      const rule = STYLE_PROPS[prop];
      if (!rule || !rule.test(val) || /url\(|expression|javascript/i.test(val)) return null;
      return `${prop}: ${val}`;
    })
    .filter(Boolean)
    .join("; ");
}

function clean(parent) {
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) continue;
    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.remove();
      continue;
    }
    const tag = node.tagName.toLowerCase();
    if (DROP_TAGS.has(tag)) {
      node.remove();
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      clean(node);
      while (node.firstChild) parent.insertBefore(node.firstChild, node);
      node.remove();
      continue;
    }
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      if (name === "style") {
        const style = filterStyle(attr.value);
        if (style) node.setAttribute("style", style);
        else node.removeAttribute(attr.name);
        continue;
      }
      if (!(ALLOWED_ATTRS[tag] || []).includes(name)) {
        node.removeAttribute(attr.name);
        continue;
      }
      if (name === "href" && !SAFE_HREF.test(attr.value.trim())) node.removeAttribute(attr.name);
    }
    if (tag === "a" && node.getAttribute("href")) {
      node.setAttribute("rel", "noopener noreferrer");
      node.setAttribute("target", "_blank");
    }
    clean(node);
  }
}

/** Sanitised copy of an HTML fragment. Returns the input untouched on the server. */
export function sanitizeHtml(html) {
  if (!html) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  clean(doc.body);
  return doc.body.innerHTML;
}

/** True when the fragment holds no visible text (a fresh tab, or only empty lines). */
export function isBlankHtml(html) {
  if (!html) return true;
  return !/[^\s ]/.test(
    String(html)
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " "),
  );
}
