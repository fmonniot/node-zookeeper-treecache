import { ConnectionStateManager } from "../src/ConnectionStateManager"
import { CuratorFramework } from "../src/CuratorFramework"
import { State } from "node-zookeeper-client"
import { ConnectionState } from "../src/ConnectionState"

const CuratorMock = jest.fn<CuratorFramework>(() => ({}))
const curator: CuratorFramework = new CuratorMock()

describe("ConnectionStateManager", () => {
  let csm: ConnectionStateManager

  let zk = {
    fire: null,
    state: null,

    addListener(_: "state", cb: (state: State) => void) {
      this.fire = cb
      return this
    },

    getState(): State {
      return this.state
    }
  }

  beforeEach(() => {
    // Reset Zk mock
    zk.fire = null
    zk.state = null

    csm = new ConnectionStateManager(zk, curator)
  })

  it("add a state listener on the ZooKeeper client ", () => {
    expect(zk.fire).not.toBeNull()
  })

  it("returns the ZooKeeper state", () => {
    const verify = (s: State, cs: ConnectionState) => {
      zk.state = s
      expect(csm.connectionState).toEqual(cs)
    }

    verify(State.AUTH_FAILED, ConnectionState.LOST)
    verify(State.CONNECTED_READ_ONLY, ConnectionState.READ_ONLY)
    verify(State.DISCONNECTED, ConnectionState.SUSPENDED)
    verify(State.EXPIRED, ConnectionState.LOST)

    verify(State.SASL_AUTHENTICATED, ConnectionState.CONNECTED)
    verify(State.SYNC_CONNECTED, ConnectionState.CONNECTED)
  })

  // Because state is not an enum, we have to provide a default case
  it("accepts bad looking state", () => {
    zk.state = {}
    expect(csm.connectionState).toEqual(ConnectionState.SUSPENDED)
  })

  it("returns RECONNECTED state when the connection have been lost at least once", () => {
    const verify = (s: State, cs: ConnectionState) => {
      zk.state = s

      // Simulate a reconnect event
      zk.fire(State.SYNC_CONNECTED)
      zk.fire(State.DISCONNECTED)
      zk.fire(State.SYNC_CONNECTED)

      expect(csm.connectionState).toEqual(cs)
    }

    verify(State.SASL_AUTHENTICATED, ConnectionState.RECONNECTED)
    verify(State.SYNC_CONNECTED, ConnectionState.RECONNECTED)
  })

  it("can tell if the client is connected to ZooKeeper", () => {
    zk.state = State.SYNC_CONNECTED
    expect(csm.isConnected).toEqual(true)

    zk.state = State.DISCONNECTED
    expect(csm.isConnected).toEqual(false)
  })

  it("add and remove connection state listener", () => {
    let fn = jest.fn()

    csm.addConnectionStateListener(fn)

    zk.fire(State.SYNC_CONNECTED)
    expect(fn).toHaveBeenCalledWith(curator, ConnectionState.CONNECTED)
    expect(fn).toHaveBeenCalledTimes(1)

    csm.removeConnectionStateListener(fn)

    zk.fire(State.SYNC_CONNECTED)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("don't crash when throw in listener", () => {
    let fn = () => {
      throw new Error("")
    }
    csm.addConnectionStateListener(fn)

    expect(() => {
      zk.fire(State.SYNC_CONNECTED)
    }).not.toThrow()
  })

  it("doesn't do anything when trying to remove an non existing listener", () => {
    let fn = jest.fn()
    let fn2 = jest.fn()

    csm.addConnectionStateListener(fn)
    csm.removeConnectionStateListener(fn2)

    zk.fire(State.SYNC_CONNECTED)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledTimes(0)
  })
})
