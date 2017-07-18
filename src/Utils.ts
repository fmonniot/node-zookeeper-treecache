/**
 * @module node-zk-treecache
 */
/**  */

/**
 * @private
 */
export function checkNotNull<T>(ref: T, message: string): T {
  if (ref === null) {
    throw new Error(message)
  } else {
    return ref
  }
}
