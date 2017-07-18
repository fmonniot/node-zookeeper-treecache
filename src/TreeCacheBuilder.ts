/**
 * @module node-zk-treecache
 */
/**  */

import { Client } from "node-zookeeper-client"

import {
  TreeCacheSelector,
  DefaultTreeCacheSelector
} from "./TreeCacheSelector"
import { TreeCache, TreeCacheImpl, Logger } from "./TreeCache"
import { newCuratorFramework } from "./CuratorFramework"

export interface TreeCacheBuilder {
  build(): TreeCache
}

export interface ConsoleLike {
  log(message?: any, ...optionalParams: any[]): void
}

export const consoleLogger = (id: number, console: ConsoleLike) => ({
  id: Math.ceil(id * 1000),
  debug(msg: string, ...args: any[]): void {
    console.log(`[${this.id}][debug]${msg}`, ...args)
  },
  info(msg: string, ...args: any[]): void {
    console.log(`[${this.id}][info]${msg}`, ...args)
  },
  warn(msg: string, ...args: any[]): void {
    console.log(`[${this.id}][warn]${msg}`, ...args)
  },
  error(msg: string, ...args: any[]): void {
    console.log(`[${this.id}][error]${msg}`, ...args)
  }
})

export class TreeCacheBuilder {
  private cacheData: boolean = true

  private maxDepth: number = Number.MAX_VALUE
  private createParentNodes: boolean = false
  private selector: TreeCacheSelector = new DefaultTreeCacheSelector()
  private logger: Logger = consoleLogger(Math.random(), console)

  constructor(private client: Client, private path: string) {}

  build(): TreeCache {
    return new TreeCacheImpl(
      newCuratorFramework(this.client),
      this.logger, // TODO Expose this in the builder
      this.path,
      this.cacheData,
      this.maxDepth,
      this.createParentNodes,
      this.selector
    )
  }

  withLogger(logger: Logger) {
    this.logger = logger
    return this
  }

  withCacheData(cacheData: boolean) {
    this.cacheData = cacheData
    return this
  }

  withMaxDepth(maxDepth: number) {
    this.maxDepth = maxDepth
    return this
  }

  withCreateParentNodes(createParentNodes: boolean) {
    this.createParentNodes = createParentNodes
    return this
  }

  withSelector(selector: TreeCacheSelector) {
    this.selector = selector
    return this
  }
}
