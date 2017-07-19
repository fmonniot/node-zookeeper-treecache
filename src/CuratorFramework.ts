/**
 * @module node-zk-treecache
 */
/**  */

import {
  Client,
  createClient,
  State,
  Exception,
  Event,
  Stat
} from "node-zookeeper-client"
import {
  ConnectionStateManager,
  ConnectionStateListener
} from "./ConnectionStateManager"
import {
  createGetChildrenCuratorEvent,
  createGetDataCuratorEvent,
  CuratorEvent
} from "./CuratorEvent"
import {
  GetChildrenBuilder,
  newGetChildrenBuilder,
  GetDataBuilder,
  newGetDataBuilder,
  ExistsBuilder,
  newExistsBuilder
} from "./Builders"
import * as ZkPaths from "./ZkPaths"

export interface CuratorFramework {
  createContainers(
    path: string,
    cb: (err: Error | Exception, path: string) => void
  ): void

  addConnectionStateListener(listener: ConnectionStateListener): void

  removeConnectionStateListener(listener: ConnectionStateListener): void

  // if the ZK client is connected
  isConnected(): boolean

  getChildren(): GetChildrenBuilder

  getData(): GetDataBuilder

  checkExists(): ExistsBuilder
}

export function newCuratorFramework(zkClient: Client): CuratorFramework {
  const zk = zkClient as any
  zk.connectionManager.setMaxListeners(100)
  return new CuratorFrameworkImpl(zk)
}

/**
 * @private
 */
export class CuratorFrameworkImpl implements CuratorFramework {
  private connectionStateManager: ConnectionStateManager

  constructor(public zkClient: Client) {
    this.connectionStateManager = new ConnectionStateManager(
      this.zkClient,
      this
    )
  }

  createContainers(
    path: string,
    cb: (err: Error | Exception, path: string) => void
  ): void {
    ZkPaths.mkdirs(this.zkClient, path, true, null, true, cb)
  }

  addConnectionStateListener(listener: ConnectionStateListener): void {
    this.connectionStateManager.addConnectionStateListener(listener)
  }

  removeConnectionStateListener(listener: ConnectionStateListener): void {
    this.connectionStateManager.removeConnectionStateListener(listener)
  }

  // if the ZK client is connected
  isConnected(): boolean {
    return this.connectionStateManager.isConnected
  }

  getChildren(): GetChildrenBuilder {
    return newGetChildrenBuilder(this)
  }

  getData(): GetDataBuilder {
    return newGetDataBuilder(this)
  }

  checkExists(): ExistsBuilder {
    return newExistsBuilder(this)
  }
}
