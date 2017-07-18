/**
 * @module node-zk-treecache
 */
/**  */

import { CuratorFramework } from "./CuratorFramework"
import {
  ZooKeeperWatcher,
  CuratorCallback,
  ZooKeeperEvent,
  ZooKeeperEventType
} from "./Builders"
import { CuratorEvent, CuratorEventType, ZooKeeperCode } from "./CuratorEvent"
import { ConnectionStateListener } from "./ConnectionStateManager"
import { ConnectionState } from "./ConnectionState"
import { TreeCacheSelector } from "./TreeCacheSelector"
import { validatePath } from "./PathUtils"
import { checkNotNull } from "./Utils"
import * as ZkPaths from "./ZkPaths"
import { type } from "os"

export interface ZooKeeperStat {
  czxid: Buffer
  mzxid: Buffer
  ctime: Buffer
  mtime: Buffer
  version: number
  cversion: number
  aversion: number
  ephemeralOwner: Buffer
  dataLength: number
  numChildren: number
  pzxid: Buffer
}

export interface ChildData {
  readonly path: string
  readonly stat: ZooKeeperStat
  readonly data: Buffer | undefined
}

export function compareChildData(cd1: ChildData, cd2: ChildData): boolean {
  if (cd1 === cd2) return true

  if (!cd1.data && cd2.data) return false
  if (cd1.data && !cd2.data) return false
  if (cd1.data && cd2.data && !cd1.data.equals(cd2.data)) return false

  if (cd1.path !== cd2.path) return false

  if (cd1.stat.czxid.toString("base64") !== cd2.stat.czxid.toString("base64"))
    return false
  if (cd1.stat.mzxid.toString("base64") !== cd2.stat.mzxid.toString("base64"))
    return false
  if (cd1.stat.ctime.toString("base64") !== cd2.stat.ctime.toString("base64"))
    return false
  if (cd1.stat.mtime.toString("base64") !== cd2.stat.mtime.toString("base64"))
    return false
  if (cd1.stat.version !== cd2.stat.version) return false
  if (cd1.stat.cversion !== cd2.stat.cversion) return false
  if (cd1.stat.aversion !== cd2.stat.aversion) return false
  if (
    cd1.stat.ephemeralOwner.toString("base64") !==
    cd2.stat.ephemeralOwner.toString("base64")
  )
    return false
  if (cd1.stat.dataLength !== cd2.stat.dataLength) return false
  if (cd1.stat.numChildren !== cd2.stat.numChildren) return false

  return cd1.stat.pzxid.toString("base64") === cd2.stat.pzxid.toString("base64")
}

export interface TreeCache {
  /**
   * Start the cache. The cache is not started automatically. You must call this method.
   *
   * @return this once initialized
   * @throws Exception errors
   */
  start(): Promise<TreeCache>

  /**
   * Close/end the cache.
   */
  close(): void

  /**
   * Return the current set of children at the given path, mapped by child name. There are no
   * guarantees of accuracy; this is merely the most recent view of the data.  If there is no
   * node at this path, {@code null} is returned.
   *
   * @param fullPath full path to the node to check
   * @return a possibly-empty list of children if the node is alive, or null
   */
  getCurrentChildren(fullPath: string): Map<string, ChildData> | null

  /**
   * Return the current data for the given path. There are no guarantees of accuracy. This is
   * merely the most recent view of the data. If there is no node at the given path,
   * {@code null} is returned.
   *
   * @param fullPath full path to the node to check
   * @return data if the node is alive, or null
   */
  getCurrentData(fullPath: string): ChildData | null

  /**
   * Add the given listener.
   *
   * @param listener listener to add
   * @return this
   */
  addListener(listener: TreeCacheListener): TreeCache

  /**
   * Remove the given listener.
   *
   * @param listener listener to remove
   * @return this
   */
  removeListener(listener: TreeCacheListener): TreeCache

  addErrorListener(listener: UnhandledErrorListener): TreeCache

  removeErrorListener(listener: UnhandledErrorListener): TreeCache
}

enum NodeState {
  PENDING = "PENDING",
  LIVE = "LIVE",
  DEAD = "DEAD"
}

export interface Logger {
  id: number

  debug(msg: string, ...args: any[]): void

  info(msg: string, ...args: any[]): void

  warn(msg: string, ...args: any[]): void

  error(msg: string, ...args: any[]): void
}

export interface TreeCacheView {
  maxDepth: number
  selector: TreeCacheSelector
  cacheData: boolean
  isInitialized: boolean
  client: CuratorFramework
  outstandingOps: number

  treeState(): TreeState

  publishEventType(type: TreeCacheEventType): void

  publishEventTypeWithData(
    type: TreeCacheEventType,
    childData: ChildData | null
  ): void

  handleException(e: Error): void
}

class TreeNode implements ZooKeeperWatcher, CuratorCallback {
  private _children: Map<string, TreeNode> | null = new Map()
  private _childData: ChildData | null
  private depth: number
  private _nodeState: NodeState = NodeState.PENDING

  constructor(
    private _path: string,
    private parent: TreeNode | null,
    private treeCacheView: TreeCacheView,
    private logger: Logger
  ) {
    this.depth = parent === null ? 0 : parent.depth + 1
  }

  public get path(): string {
    return this._path
  }

  public get nodeState(): NodeState {
    return this._nodeState
  }

  public get children(): Map<string, TreeNode> | null {
    return this._children
  }

  public get childData() {
    return this._childData
  }

  wasCreated() {
    this.refresh()
  }

  wasDeleted() {
    const oldChildData = this._childData
    this._childData = null

    const childMap = this._children
    this._children = null

    if (childMap !== null) {
      const childCopy = Array.from(childMap.values())
      childMap.clear()
      for (let child of childCopy) {
        child.wasDeleted()
      }
    }

    if (this.treeCacheView.treeState() === TreeState.CLOSED) {
      return
    }

    const oldState = this._nodeState
    if (oldState === NodeState.LIVE) {
      this.treeCacheView.publishEventTypeWithData(
        TreeCacheEventType.NODE_REMOVED,
        oldChildData
      )
    }

    if (this.parent == null) {
      // Root node; use an exist query to watch for existence.
      this.treeCacheView.client
        .checkExists()
        .withWatcher(this)
        .withCallback(this)
        .forPath(this._path)
        .catch(reason => {
          this.logger.debug(
            `[Node ${this.path}]`,
            "wasDeleted#checkExists failed with reason",
            reason
          )
        })
    } else {
      // Remove from parent if we're currently a child
      const parentChildMap = this.parent.children
      if (parentChildMap != null) {
        parentChildMap.delete(ZkPaths.getNodeFromPath(this.path))
      }
    }
  }

  wasReconnected() {
    this.refresh()

    if (this.children !== null) {
      for (let child of this.children.values()) {
        child.wasReconnected()
      }
    }
  }

  onCuratorEvent(client: CuratorFramework, event: CuratorEvent): void {
    const loggedEvent = Object.assign({}, event, { stat: "hidden" })
    this.logger.debug("onCuratorEvent( event = ", loggedEvent, ")")

    switch (event.type) {
      case CuratorEventType.EXISTS:
        if (this.parent !== null)
          throw new Error("unexpected EXISTS on non-root node")
        if (event.returnCode === ZooKeeperCode.OK) {
          if (this._nodeState === NodeState.DEAD) {
            this._nodeState = NodeState.PENDING
          }
          this.wasCreated()
        }
        break

      case CuratorEventType.CHILDREN: {
        if (event.returnCode === ZooKeeperCode.OK) {
          if (event.stat === undefined) {
            this.logger.error(
              "TreeCache got an event CHILDREN with a status code OK but an undefined stat"
            )
            break
          }
          if (event.children === undefined) {
            this.logger.error(
              "TreeCache got an event CHILDREN with a status code OK but an undefined children"
            )
            break
          }
          const newStat = event.stat
          const oldChildData = this._childData
          if (
            oldChildData !== null &&
            oldChildData.stat.mzxid.toString("base64") ===
              newStat.mzxid.toString("base64")
          ) {
            // Only update stat if mzxid is same, otherwise we might obscure
            // GET_DATA event updates.
            const newChildData = {
              path: oldChildData.path,
              stat: newStat,
              data: oldChildData.data
            }

            if (compareChildData(oldChildData, newChildData)) {
              this._childData = newChildData
            }
          }

          if (event.children.length < 1) break

          // Create map if not previously done
          let childMap = this._children
          if (childMap === null) {
            childMap = new Map()
            if (this._children === null) {
              this._children = childMap
            } else {
              childMap = this._children
            }
          }

          // Present new children in sorted order for test determinism
          const newChildren: string[] = []
          for (const child of event.children) {
            if (
              !childMap.has(child) &&
              this.treeCacheView.selector.acceptChild(
                ZkPaths.makePath(this.path, child)
              )
            ) {
              newChildren.push(child)
            }
          }

          newChildren.sort()
          for (const child of newChildren) {
            const fullPath = ZkPaths.makePath(this.path, child)
            const node = new TreeNode(
              fullPath,
              this,
              this.treeCacheView,
              this.logger
            )

            if (!childMap.has(child)) {
              childMap.set(child, node)
              node.wasCreated()
            }
          }
        } else if (event.returnCode === ZooKeeperCode.NONODE) {
          this.wasDeleted()
        }
        break
      }

      case CuratorEventType.GET_DATA: {
        if (event.returnCode === ZooKeeperCode.OK) {
          if (event.stat === undefined) {
            this.logger.error(
              "TreeCache got an event GET_DATA with a status code OK but an undefined stat"
            )
            break
          }

          const newStat = event.stat
          const toPublish: ChildData = {
            path: event.path,
            stat: newStat,
            data: event.data
          }
          let oldChildData = this._childData

          if (this.treeCacheView.cacheData) {
            this._childData = toPublish
          } else {
            this._childData = {
              path: event.path,
              stat: newStat,
              data: undefined
            }
          }

          let added: boolean
          if (this.parent === null) {
            // We're the singleton root.
            const nodeState = this._nodeState
            this._nodeState = NodeState.LIVE

            added = nodeState !== NodeState.LIVE
          } else {
            if (this._nodeState === NodeState.PENDING) {
              this._nodeState = NodeState.LIVE
              added = true
            } else {
              added = false

              // Ordinary nodes are not allowed to transition from dead -> live;
              // make sure this isn't a delayed response that came in after death.
              if (this.nodeState !== NodeState.LIVE) return
            }
          }

          if (added) {
            this.treeCacheView.publishEventTypeWithData(
              TreeCacheEventType.NODE_ADDED,
              toPublish
            )
          } else {
            if (
              oldChildData === null ||
              oldChildData.stat.mzxid.toString("base64") !==
                newStat.mzxid.toString("base64")
            ) {
              this.treeCacheView.publishEventTypeWithData(
                TreeCacheEventType.NODE_UPDATED,
                toPublish
              )
            }
          }
        } else if (event.returnCode === ZooKeeperCode.NONODE) {
          this.wasDeleted()
        }
        break
      }
    }

    this.treeCacheView.outstandingOps--
    if (this.treeCacheView.outstandingOps === 0) {
      if (this.treeCacheView.isInitialized === false) {
        this.treeCacheView.isInitialized = true
        this.treeCacheView.publishEventType(TreeCacheEventType.INITIALIZED)
      }
    }
  }

  onZooKeeperEvent(event: ZooKeeperEvent): void {
    this.logger.debug(`[Node ${this.path}] onZooKeeperEvent`, event)
    try {
      switch (event.type) {
        case ZooKeeperEventType.NODE_CREATED:
          if (this.parent !== null)
            throw new Error("Unexpected NODE_CREATED on non-root node")
          this.wasCreated()
          break
        case ZooKeeperEventType.NODE_CHILDREN_CHANGED:
          this.refreshChildren()
          break
        case ZooKeeperEventType.NODE_DATA_CHANGED:
          this.refreshData()
          break
        case ZooKeeperEventType.NODE_DELETED:
          this.wasDeleted()
          break
      }
    } catch (e) {
      this.treeCacheView.handleException(e)
    }
  }

  private refresh() {
    if (
      this.depth < this.treeCacheView.maxDepth &&
      this.treeCacheView.selector.traverseChildren(this.path)
    ) {
      this.treeCacheView.outstandingOps += 2
      this.doRefreshData()
      this.doRefreshChildren()
    } else {
      this.refreshData()
    }
  }

  private refreshData() {
    this.treeCacheView.outstandingOps++
    this.doRefreshData()
  }

  private doRefreshData() {
    if (this.treeCacheView.treeState() === TreeState.STARTED) {
      this.treeCacheView.client
        .getData()
        .withWatcher(this)
        .withCallback(this)
        .forPath(this.path)
        .catch(reason => {
          this.logger.debug(
            `[Node ${this.path}]`,
            "doRefreshData() failed with reason",
            reason
          )
        })
    }
  }

  private refreshChildren() {
    if (
      this.depth < this.treeCacheView.maxDepth &&
      this.treeCacheView.selector.traverseChildren(this.path)
    ) {
      this.treeCacheView.outstandingOps++
      this.doRefreshChildren()
    }
  }

  private doRefreshChildren() {
    if (this.treeCacheView.treeState() === TreeState.STARTED) {
      this.treeCacheView.client
        .getChildren()
        .withWatcher(this)
        .withCallback(this)
        .forPath(this.path)
        .catch(reason => {
          this.logger.debug(
            `[Node ${this.path}]`,
            "doRefreshChildren() failed with reason",
            reason
          )
        })
    }
  }
}

export class TreeCacheEvent {
  constructor(
    private _type: TreeCacheEventType,
    private _data: ChildData | null,
    private _date: Date
  ) {}

  public get type() {
    return this._type
  }

  public get data(): ChildData | null {
    return this._data
  }

  public get path(): string | null {
    return this._data !== null ? this._data.path : null
  }

  public get date() {
    return this._date
  }

  toString() {
    let data: string
    if (this._data) {
      data = JSON.stringify(
        Object.assign({}, this._data, {
          stat: this._data.stat ? "defined" : "undefined"
        })
      )
    } else {
      data = "undefined"
    }
    return `TreeCacheEvent { type = ${this._type.toString()}, path = ${this
      .path}, data = ${data} }`
  }
}

export enum TreeCacheEventType {
  /**
   * A node was added.
   */
  NODE_ADDED = "NODE_ADDED",

  /**
     * A node's data was changed
     */
  NODE_UPDATED = "NODE_UPDATED",

  /**
     * A node was removed from the tree
     */
  NODE_REMOVED = "NODE_REMOVED",

  /**
     * Called when the connection has changed to {@link ConnectionState#SUSPENDED}
     * <p>
     * This is exposed so that users of the class can be notified of issues that *might* affect normal operation.
     * The TreeCache is written such that listeners are not expected to do anything special on this
     * event, except for those people who want to cause some application-specific logic to fire when this occurs.
     * While the connection is down, the TreeCache will continue to have its state from before it lost
     * the connection and after the connection is restored, the TreeCache will emit normal child events
     * for all of the adds, deletes and updates that happened during the time that it was disconnected.
     * </p>
     */
  CONNECTION_SUSPENDED = "CONNECTION_SUSPENDED",

  /**
     * Called when the connection has changed to {@link ConnectionState#RECONNECTED}
     * <p>
     * This is exposed so that users of the class can be notified of issues that *might* affect normal operation.
     * The TreeCache is written such that listeners are not expected to do anything special on this
     * event, except for those people who want to cause some application-specific logic to fire when this occurs.
     * While the connection is down, the TreeCache will continue to have its state from before it lost
     * the connection and after the connection is restored, the TreeCache will emit normal child events
     * for all of the adds, deletes and updates that happened during the time that it was disconnected.
     * </p><p>
     * After reconnection, the cache will resynchronize its internal state with the server, then fire a
     * {@link #INITIALIZED} event.
     * </p>
     */
  CONNECTION_RECONNECTED = "CONNECTION_RECONNECTED",

  /**
     * Called when the connection has changed to {@link ConnectionState#LOST}
     * <p>
     * This is exposed so that users of the class can be notified of issues that *might* affect normal operation.
     * The TreeCache is written such that listeners are not expected to do anything special on this
     * event, except for those people who want to cause some application-specific logic to fire when this occurs.
     * While the connection is down, the TreeCache will continue to have its state from before it lost
     * the connection and after the connection is restored, the TreeCache will emit normal child events
     * for all of the adds, deletes and updates that happened during the time that it was disconnected.
     * </p>
     */
  CONNECTION_LOST = "CONNECTION_LOST",

  /**
     * Posted after the initial cache has been fully populated.
     * <p>
     * On startup, the cache synchronizes its internal
     * state with the server, publishing a series of {@link #NODE_ADDED} events as new nodes are discovered.  Once
     * the cachehas been fully synchronized, this {@link #INITIALIZED} this event is published.  All events
     * published after this event represent actual server-side mutations.
     * </p><p>
     * On reconnection, the cache will resynchronize its internal state with the server, and fire this event again
     * once its internal state is completely refreshed.
     * </p><p>
     * Note: because the initial population is inherently asynchronous, so it's possible to observe server-side changes
     * (such as a {@link #NODE_UPDATED}) prior to this event being published.
     * </p>
     */
  INITIALIZED = "INITIALIZED"
}

export type TreeCacheListener = (
  client: CuratorFramework,
  event: TreeCacheEvent
) => void

export type UnhandledErrorListener = (message: string, error: Error) => void

/**
 * @private
 */
export enum TreeState {
  LATENT,
  STARTED,
  CLOSED
}

/**
 * @private
 */
export class TreeCacheImpl implements TreeCache, TreeCacheView {
  // Have we published the {@link TreeCacheEventType#INITIALIZED} event yet?
  public isInitialized: boolean = false

  private root: TreeNode

  private _treeState: TreeState = TreeState.LATENT

  private listeners: TreeCacheListener[] = []
  private errorListeners: UnhandledErrorListener[] = []

  // noinspection JSUnusedGlobalSymbols because it's necessary to satisfy TreeCacheView
  constructor(
    public client: CuratorFramework,
    private logger: Logger,
    path: string,
    public cacheData: boolean,
    public maxDepth: number,
    private createParentNodes: boolean,
    public selector: TreeCacheSelector,
    public outstandingOps: number = 0
  ) {
    this.root = new TreeNode(validatePath(path), null, this, this.logger)
    checkNotNull(this.client, `curator client cannot be null`)
  }

  treeState() {
    return this._treeState
  }

  start(): Promise<TreeCache> {
    if (this._treeState === TreeState.STARTED)
      throw new Error("cache already started")
    this._treeState = TreeState.STARTED

    return new Promise<TreeCache>((resolve, reject) => {
      const next = (err: any | null) => {
        if (err) return reject(err)

        this.client.addConnectionStateListener(this.connectionStateListener)

        if (this.client.isConnected()) {
          this.root.wasCreated()
        }

        resolve(this)
      }

      if (this.createParentNodes) {
        this.client.createContainers(this.root.path, next)
      } else {
        next(null)
      }
    })
  }

  close(): void {
    this.logger.debug(
      "TreeCache#close() when tree state = ",
      this._treeState,
      " and have ",
      this.listeners.length,
      " listeners"
    )
    if (this._treeState === TreeState.STARTED) {
      this._treeState = TreeState.CLOSED

      this.client.removeConnectionStateListener(this.connectionStateListener)
      this.listeners.length = 0 // clear the array

      try {
        this.root.wasDeleted()
      } catch (e) {
        this.handleException(e)
      }
    }
  }

  getCurrentChildren(fullPath: string): Map<string, ChildData> | null {
    const node = this.find(fullPath)
    if (node === null || node.nodeState !== NodeState.LIVE) {
      return null
    }

    const map: Map<string, TreeNode> | null = node.children
    let result: Map<string, ChildData> = new Map()

    if (map !== null) {
      for (let [key, childNode] of map) {
        const childData = childNode.childData
        if (childData !== null && childNode.nodeState === NodeState.LIVE) {
          result.set(key, childData)
        }
      }
    }

    return node.nodeState === NodeState.LIVE ? result : null
  }

  getCurrentData(fullPath: string): ChildData | null {
    const node = this.find(fullPath)
    if (node === null || node.nodeState !== NodeState.LIVE) {
      return null
    }

    const result = node.childData

    return node.nodeState === NodeState.LIVE ? result : null
  }

  addListener(listener: TreeCacheListener): TreeCache {
    this.listeners.push(listener)
    return this
  }

  removeListener(listener: TreeCacheListener): TreeCache {
    const i = this.listeners.indexOf(listener)

    if (i > -1) {
      this.listeners.splice(i, 1)
    }

    return this
  }

  addErrorListener(listener: UnhandledErrorListener): TreeCache {
    this.errorListeners.push(listener)
    return this
  }

  removeErrorListener(listener: UnhandledErrorListener): TreeCache {
    const i = this.errorListeners.indexOf(listener)

    if (i > -1) {
      this.errorListeners.splice(i, 1)
    }

    return this
  }

  handleException(e: Error) {
    if (this.errorListeners.length === 0) {
      this.logger.error("", e)
    } else {
      this.errorListeners.forEach(listener => {
        try {
          listener("", e)
        } catch (e) {
          this.logger.error("Exception handling exception", e)
        }
      })
    }
  }

  publishEventType(type: TreeCacheEventType) {
    this.publishEvent(new TreeCacheEvent(type, null, new Date()))
  }

  publishEventTypeWithData(type: TreeCacheEventType, data: ChildData | null) {
    this.publishEvent(new TreeCacheEvent(type, data, new Date()))
  }

  private connectionStateListener: ConnectionStateListener = (_, newState) => {
    this.handleStateChange(newState)
  }

  private find(findPath: string): TreeNode | null {
    const rootElements = ZkPaths.split(this.root.path)
    const findElements = ZkPaths.split(findPath)

    while (rootElements.length > 0) {
      if (findElements.length === 0) {
        // Target path shorter than root path
        return null
      }

      const nextRoot = rootElements.shift()
      const nextFind = findElements.shift()

      if (nextFind !== nextRoot) {
        // Initial root path does not match
        return null
      }
    }

    let current = this.root
    while (findElements.length > 0) {
      const nextFind = findElements.shift()
      const map = current.children

      if (map == null) return null
      if (nextFind === undefined) return null

      let nextCurrent = map.get(nextFind)
      if (nextCurrent === undefined) return null

      current = nextCurrent
    }

    return current
  }

  private handleStateChange(newState: ConnectionState): void {
    switch (newState) {
      case ConnectionState.SUSPENDED:
        this.publishEventType(TreeCacheEventType.CONNECTION_SUSPENDED)
        break
      case ConnectionState.LOST:
        this.isInitialized = false
        this.publishEventType(TreeCacheEventType.CONNECTION_LOST)
        break
      case ConnectionState.CONNECTED:
        try {
          this.root.wasCreated()
        } catch (e) {
          this.handleException(e)
        }
        break
      case ConnectionState.RECONNECTED:
        try {
          this.root.wasReconnected()
          this.publishEventType(TreeCacheEventType.CONNECTION_RECONNECTED)
        } catch (e) {
          this.handleException(e)
        }
        break
      case ConnectionState.READ_ONLY:
      // do nothing
    }
  }

  private publishEvent(ev: TreeCacheEvent) {
    if (this._treeState !== TreeState.CLOSED) {
      const loggedEvent = Object.assign({}, ev, {
        _data: Object.assign({}, ev.data, { stat: "hidden" })
      })
      this.logger.debug("publishEvent", loggedEvent)

      process.nextTick(() => {
        this.listeners.forEach(listener => {
          try {
            listener(this.client, ev)
          } catch (e) {
            this.handleException(e)
          }
        })
      })
    }
  }
}
