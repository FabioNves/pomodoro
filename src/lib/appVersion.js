// Comparing released versions. Shared by the update banner and its tests.

/**
 * Compare two dot-separated versions numerically.
 * Returns a positive number when `a` is newer than `b`, 0 when they match.
 *
 * A pre-release suffix ("1.2.0-beta.1") sorts before the release it precedes,
 * which is what semantic versioning means by it, so a beta never looks like
 * an upgrade over the final build of the same number.
 */
export function compareVersions(a, b) {
  const split = (value) => {
    const [core, pre = ""] = String(value || "").trim().split(/[-+]/, 2);
    return {
      parts: core.split(".").map((n) => Number.parseInt(n, 10) || 0),
      pre,
    };
  };
  const left = split(a);
  const right = split(b);

  const length = Math.max(left.parts.length, right.parts.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (left.parts[i] || 0) - (right.parts[i] || 0);
    if (diff !== 0) return diff;
  }
  if (left.pre === right.pre) return 0;
  if (!left.pre) return 1; // a release beats its own pre-release
  if (!right.pre) return -1;
  return left.pre > right.pre ? 1 : -1;
}

/** True when `latest` is a version worth offering over `current`. */
export function isNewerVersion(latest, current) {
  if (!latest || !current) return false;
  if (!/^\d/.test(String(latest).trim())) return false;
  return compareVersions(latest, current) > 0;
}
