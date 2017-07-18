import { ConnectionState, isConnected } from "../src/ConnectionState"

describe("#isConnected", () => {
  it("return true for connected state", () => {
    expect(isConnected(ConnectionState.CONNECTED)).toEqual(true)
    expect(isConnected(ConnectionState.RECONNECTED)).toEqual(true)
    expect(isConnected(ConnectionState.READ_ONLY)).toEqual(true)
  })

  it("return false for disconnected state", () => {
    expect(isConnected(ConnectionState.SUSPENDED)).toEqual(false)
    expect(isConnected(ConnectionState.LOST)).toEqual(false)
  })
})
