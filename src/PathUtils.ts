/**
 * @module node-zk-treecache
 */
/**  */

export { validatePath }

/**
 * Validate the provided znode path string
 * @param path znode path string
 * @return The given path if it was valid, for fluent chaining
 * @throws Error if the path is invalid
 */
function validatePath(path: string): string {
  if (path == null) {
    throw new Error("Path cannot be null")
  }
  if (path.length === 0) {
    throw new Error("Path length must be > 0")
  }
  if (path.charAt(0) !== "/") {
    throw new Error("Path must start with / character")
  }
  if (path.length === 1) {
    // done checking - it's the root
    return path
  }
  if (path.charAt(path.length - 1) === "/") {
    throw new Error("Path must not end with / character")
  }

  let reason: string | null = null
  let lastc = "/"
  let chars: string[] = path.split("")
  let c
  for (let i = 1; i < chars.length; lastc = chars[i], i++) {
    c = chars[i]

    if (c.charCodeAt(0) === 0) {
      reason = "null character not allowed @" + i
      break
    } else if (c === "/" && lastc === "/") {
      reason = "empty node name specified @" + i
      break
    } else if (c === "." && lastc === ".") {
      if (
        chars[i - 2] === "/" &&
        (i + 1 === chars.length || chars[i + 1] === "/")
      ) {
        reason = "relative paths not allowed @" + i
        break
      }
    } else if (c === ".") {
      if (
        chars[i - 1] === "/" &&
        (i + 1 === chars.length || chars[i + 1] === "/")
      ) {
        reason = "relative paths not allowed @" + i
        break
      }
    } else if (
      (c > "\u0000" && c < "\u001f") ||
      (c > "\u007f" && c < "\u009F") ||
      (c > "\ud800" && c < "\uf8ff") ||
      (c > "\ufff0" && c < "\uffff")
    ) {
      reason = "invalid character @" + i
      break
    }
  }

  if (reason != null) {
    throw new Error('Invalid path string "' + path + '" caused by ' + reason)
  }

  return path
}
