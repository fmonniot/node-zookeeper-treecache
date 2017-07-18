/**
 * @module node-zk-treecache
 */
/**  */

import { State } from "node-zookeeper-client"
import {
  ConnectionState,
  isConnected as csIsConnected
} from "./ConnectionState"
import { CuratorFramework } from "./CuratorFramework"

export type ConnectionStateListener = (
  client: CuratorFramework,
  state: ConnectionState
) => void

export interface PartialZooKeeperClient {
  addListener(event: "state", cb: (state: State) => void): this

  getState(): State
}

/**
 * @private
 */
export class ConnectionStateManager {
  private numberOfConnectEvent: number = 0
  private listeners: ConnectionStateListener[] = []

  constructor(
    private zkClient: PartialZooKeeperClient,
    curator: CuratorFramework
  ) {
    zkClient.addListener("state", state => {
      if (
        state === State.SYNC_CONNECTED ||
        state === State.SASL_AUTHENTICATED
      ) {
        this.numberOfConnectEvent++
      }

      this.listeners.forEach(listener => {
        try {
          listener(curator, this.zkStateToCS(state))
        } catch (e) {
          // TODO Manage this error
        }
      })
    })
  }

  addConnectionStateListener(listener: ConnectionStateListener): void {
    this.listeners.push(listener)
  }

  removeConnectionStateListener(listener: ConnectionStateListener): void {
    const i = this.listeners.indexOf(listener)

    if (i > -1) {
      this.listeners.splice(i, 1)
    }
  }

  get connectionState(): ConnectionState {
    return this.zkStateToCS(this.zkClient.getState())
  }

  get isConnected(): boolean {
    return csIsConnected(this.connectionState)
  }

  private zkStateToCS(s: State | undefined) {
    switch (s) {
      case State.DISCONNECTED:
        return ConnectionState.SUSPENDED
      case State.SYNC_CONNECTED:
        return this.numberOfConnectEvent > 1
          ? ConnectionState.RECONNECTED
          : ConnectionState.CONNECTED
      case State.AUTH_FAILED:
        return ConnectionState.LOST
      case State.CONNECTED_READ_ONLY:
        return ConnectionState.READ_ONLY
      case State.SASL_AUTHENTICATED:
        return this.numberOfConnectEvent > 1
          ? ConnectionState.RECONNECTED
          : ConnectionState.CONNECTED
      case State.EXPIRED:
        return ConnectionState.LOST
      default:
        return ConnectionState.SUSPENDED
    }
  }
}
