/**
 * @module node-zk-treecache
 */
/**  */

import { Exception, Event, Stat } from "node-zookeeper-client"
import {
  createGetChildrenCuratorEvent,
  createGetDataCuratorEvent,
  createExistsCuratorEvent,
  CuratorEvent,
  ZooKeeperCode
} from "./CuratorEvent"
import { CuratorFramework, CuratorFrameworkImpl } from "./CuratorFramework"

export enum ZooKeeperEventType {
  NODE_CREATED,
  NODE_DELETED,
  NODE_DATA_CHANGED,
  NODE_CHILDREN_CHANGED
}

export interface ZooKeeperEvent {
  readonly type: ZooKeeperEventType
  readonly name: string
  readonly path: string

  toString(): string
}

export interface CuratorCallback {
  onCuratorEvent(client: CuratorFramework, event: CuratorEvent): void
}

export interface ZooKeeperWatcher {
  onZooKeeperEvent(event: ZooKeeperEvent): void
}

function normalizeZooKeeperEvent(e: Event): ZooKeeperEvent {
  const name = e.getName()
  const path = e.getPath()

  switch (Number(e.getType())) {
    case Event.NODE_CREATED:
      return { type: ZooKeeperEventType.NODE_CREATED, name, path }
    case Event.NODE_DELETED:
      return { type: ZooKeeperEventType.NODE_DELETED, name, path }
    case Event.NODE_DATA_CHANGED:
      return { type: ZooKeeperEventType.NODE_DATA_CHANGED, name, path }
    case Event.NODE_CHILDREN_CHANGED:
      return { type: ZooKeeperEventType.NODE_CHILDREN_CHANGED, name, path }
    default:
      throw new Error(`Unknown ZooKeeper event type received: ${e}`)
  }
}

function createWatcher(w: ZooKeeperWatcher): (e: Event) => void {
  return e => w.onZooKeeperEvent(normalizeZooKeeperEvent(e))
}

abstract class AbstractGetBuilder {
  protected watcher: ZooKeeperWatcher | undefined = undefined
  protected callback: CuratorCallback | undefined = undefined

  withWatcher(watcher: ZooKeeperWatcher) {
    this.watcher = watcher
    return this
  }

  withCallback(cb: CuratorCallback) {
    this.callback = cb
    return this
  }
}

/**
 * @private
 * @param {CuratorFrameworkImpl} client
 * @returns {GetChildrenBuilder}
 */
export function newGetChildrenBuilder(
  client: CuratorFrameworkImpl
): GetChildrenBuilder {
  return new GetChildrenBuilderImpl(client)
}

export interface GetChildrenBuilder {
  withWatcher(watcher: ZooKeeperWatcher): GetChildrenBuilder

  withCallback(cb: CuratorCallback): GetChildrenBuilder

  forPath(path: string): Promise<string[]>
}

class GetChildrenBuilderImpl extends AbstractGetBuilder
  implements GetChildrenBuilder {
  constructor(private client: CuratorFrameworkImpl) {
    super()
  }

  forPath(path: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      const cb = (
        error: Error | Exception | null,
        children: string[] | undefined,
        stat: Stat | undefined
      ) => {
        if (
          !(error === undefined || error instanceof Exception || error === null)
        ) {
          return reject(error)
        }

        const event = createGetChildrenCuratorEvent(
          path,
          stat,
          children,
          (error && error.code) || 0
        )
        if (this.callback) this.callback.onCuratorEvent(this.client, event)

        if (children) return resolve(children)
        else return reject(error)
      }

      if (this.watcher !== undefined) {
        this.client.zkClient.getChildren(path, createWatcher(this.watcher), cb)
      } else {
        this.client.zkClient.getChildren(path, cb)
      }
    })
  }
}

export function newGetDataBuilder(
  client: CuratorFrameworkImpl
): GetDataBuilder {
  return new GetDataBuilderImpl(client)
}

export interface GetDataBuilder {
  withWatcher(watcher: ZooKeeperWatcher): GetDataBuilder

  withCallback(cb: CuratorCallback): GetDataBuilder

  forPath(path: string): Promise<Buffer | undefined>
}

class GetDataBuilderImpl extends AbstractGetBuilder implements GetDataBuilder {
  constructor(private client: CuratorFrameworkImpl) {
    super()
  }

  forPath(path: string): Promise<Buffer | undefined> {
    return new Promise<Buffer | undefined>((resolve, reject) => {
      const cb = (
        error: Error | Exception | null,
        data: Buffer | undefined,
        stat: Stat
      ) => {
        if (
          !(error === undefined || error instanceof Exception || error === null)
        ) {
          return reject(error)
        }

        const event = createGetDataCuratorEvent(
          path,
          stat,
          data,
          (error && error.code) || 0
        )
        if (this.callback) this.callback.onCuratorEvent(this.client, event)

        if (error) return reject(error)
        else return resolve(data)
      }

      if (this.watcher !== undefined) {
        this.client.zkClient.getData(path, createWatcher(this.watcher), cb)
      } else {
        this.client.zkClient.getData(path, cb)
      }
    })
  }
}

export function newExistsBuilder(client: CuratorFrameworkImpl): ExistsBuilder {
  return new ExistsBuilderImpl(client)
}

export interface ExistsBuilder {
  withWatcher(watcher: ZooKeeperWatcher): ExistsBuilder

  withCallback(cb: CuratorCallback): ExistsBuilder

  forPath(path: string): Promise<boolean>
}

class ExistsBuilderImpl extends AbstractGetBuilder implements ExistsBuilder {
  constructor(private client: CuratorFrameworkImpl) {
    super()
  }

  forPath(path: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      const cb = (error: Error | Exception | undefined, stat: Stat | null) => {
        if (
          !(error === undefined || error === null || error instanceof Exception)
        ) {
          return reject(error)
        }

        const rc = stat ? 0 : ZooKeeperCode.NONODE
        const event = createExistsCuratorEvent(
          path,
          stat,
          (error && error.code) || rc
        )
        if (this.callback) this.callback.onCuratorEvent(this.client, event)

        const ret = !!stat
        if (error) return reject(error)
        else return resolve(ret)
      }

      if (this.watcher !== undefined) {
        this.client.zkClient.exists(path, createWatcher(this.watcher), cb)
      } else {
        this.client.zkClient.exists(path, cb)
      }
    })
  }
}
