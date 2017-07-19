/**
 * Exported classes, this is what is available outside for users
 * TODO Tweak the documentation to reflect this property
 *
 * @module node-zk-treecache
 */
/** */

import { Client } from "node-zookeeper-client"

import { TreeCacheSelector } from "./TreeCacheSelector"
import { TreeCacheBuilder } from "./TreeCacheBuilder"
import { TreeCache, ChildData } from "./TreeCache"
import { TreeCacheEventType, TreeCacheEvent } from "./TreeCache"

function treeCacheBuilder(client: Client, path: string) {
  return new TreeCacheBuilder(client, path)
}

export {
  TreeCacheSelector,
  TreeCacheBuilder,
  TreeCache,
  treeCacheBuilder,
  TreeCacheEvent,
  TreeCacheEventType,
  ChildData
}
