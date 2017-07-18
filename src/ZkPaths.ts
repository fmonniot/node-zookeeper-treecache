/**
 * @module node-zk-treecache
 */
/**  */

import { validatePath } from "./PathUtils"
import { Client, ACL, Id, CreateMode, Exception } from "node-zookeeper-client"

const PATH_SEPARATOR = "/"
const ANYONE_ID_UNSAFE = new Id("world", "anyone")
const OPEN_ACL_UNSAFE = [new ACL(31, ANYONE_ID_UNSAFE)]
const EMPTY_CALLBACK = () => {
  return
}
const DEFAULT_ACL_PROVIDER: ACLProvider = {
  getDefaultAcl() {
    return null
  },
  getAclForPath() {
    return null
  }
}

/**
 * @private
 * @param path the path to split
 */
export function split(path: string): string[] {
  validatePath(path)

  return path.split(PATH_SEPARATOR).filter(s => s.length > 0)
}

export interface ACLProvider {
  getDefaultAcl(): ACL[] | null
  getAclForPath(path: string): ACL[] | null
}

// Verify if we are running ZK 3.5+, in which case we can use the create mode container (code 4)
function getCreateMode(asContainers: boolean) {
  return CreateMode.PERSISTENT
}

/**
 * Make sure all the nodes in the path are created. NOTE: Unlike File.mkdirs(), Zookeeper doesn't distinguish
 * between directories and files. So, every node in the path is created. The data for each node is an empty blob
 *
 * @private
 * @param zkClient     the client
 * @param path         path to ensure
 * @param makeLastNode if true, all nodes are created. If false, only the parent nodes are created
 * @param aclProvider  if not null, the ACL provider to use when creating parent nodes
 * @param asContainers if true, nodes are created as {@link CreateMode#CONTAINER} (need ZK > 3.5)
 * @param cb           the callback to call after having created the path
 */
export function mkdirs(
  zkClient: Client,
  path: string,
  makeLastNode: boolean,
  aclProvider: ACLProvider | null,
  asContainers: boolean,
  cb?: (err: Error | Exception, p: string) => void
) {
  validatePath(path)

  let s = split(path)

  if (!makeLastNode) {
    s.pop()
  }

  path = "/" + s.join("/")
  const mode = getCreateMode(asContainers)
  aclProvider = aclProvider || DEFAULT_ACL_PROVIDER
  const acl =
    aclProvider.getAclForPath(path) ||
    aclProvider.getDefaultAcl() ||
    OPEN_ACL_UNSAFE

  zkClient.mkdirp(path, acl, mode, cb || EMPTY_CALLBACK)
}

/**
 * Given a full path, return the node name. i.e. "/one/two/three" will return "three"
 *
 * @private
 * @param path the path
 * @return the node
 */
export function getNodeFromPath(path: string): string {
  validatePath(path)

  const last = path.split(PATH_SEPARATOR).pop()

  if (last === undefined)
    throw new Error(`Error while validating ${path}, it should have been valid`)

  return last
}

/**
 * Given a parent path and a child node, create a combined full path
 *
 * @param parent the parent
 * @param child  the child
 * @return full path
 */
export function makePath(parent: string, child: string): string {
  return [parent.replace(/\/+$/, ""), child.replace(/^\/+/, "")].join("/")
}
