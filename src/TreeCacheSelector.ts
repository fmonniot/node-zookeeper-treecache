/**
 * @module node-zk-treecache
 */

/**  */

/**
 * <p>
 *     Controls which nodes a TreeCache processes. When iterating
 *     over the children of a parent node, a given node's children are
 *     queried only if {@link #traverseChildren(String)} returns true.
 *     When caching the list of nodes for a parent node, a given node is
 *     stored only if {@link #acceptChild(String)} returns true.
 * </p>
 *
 * <p>
 *     E.g. Given:
 * <pre>
 * root
 *     n1-a
 *     n1-b
 *         n2-a
 *         n2-b
 *             n3-a
 *     n1-c
 *     n1-d
 * </pre>
 *     You could have a TreeCache only work with the nodes: n1-a, n1-b, n2-a, n2-b, n1-d
 *     by returning false from traverseChildren() for "/root/n1-b/n2-b" and returning
 *     false from acceptChild("/root/n1-c").
 * </p>
 */
export interface TreeCacheSelector {
  /**
   * Return true if children of this path should be cached.
   * i.e. if false is returned, this node is not queried to
   * determine if it has children or not
   *
   * @param fullPath full path of the ZNode
   * @return true/false
   */
  traverseChildren(fullPath: string): boolean

  /**
   * Return true if this node should be returned from the cache
   *
   * @param fullPath full path of the ZNode
   * @return true/false
   */
  acceptChild(fullPath: string): boolean
}

/**
 * @private
 */
export class DefaultTreeCacheSelector implements TreeCacheSelector {
  traverseChildren(_: string) {
    return true
  }

  acceptChild(_: string) {
    return true
  }
}
