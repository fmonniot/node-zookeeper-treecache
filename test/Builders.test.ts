import { Client, createClient, Stat, State } from "node-zookeeper-client"
import { ZooKeeperP, timeout } from "./TestUtils"
import {
  newExistsBuilder,
  newGetChildrenBuilder,
  newGetDataBuilder,
  ZooKeeperEventType
} from "../src/Builders"
import { CuratorFrameworkImpl } from "../src/CuratorFramework"
import { CuratorEventType, ZooKeeperCode } from "../src/CuratorEvent"

let client: Client
let curator: CuratorFrameworkImpl
let zk: ZooKeeperP

beforeAll(() => {
  client = createClient("localhost:2181")
  client.connect()
  curator = new CuratorFrameworkImpl(client)
  zk = new ZooKeeperP(client)

  return new Promise<void>(resolve => {
    client.once("connected", () => {
      resolve()
    })
  })
})

afterAll(() => {
  client.close()
})

describe("Builders", () => {
  describe("GetChildrenBuilder", () => {
    beforeEach(async () => {
      await zk.create("/builders")
      await zk.create("/builders/a")
      await zk.create("/builders/b")
    })

    afterEach(() => {
      return zk.removeRecursive("/builders")
    })

    it("returns a promise with the node children", async () => {
      return expect(
        newGetChildrenBuilder(curator).forPath("/builders")
      ).resolves.toEqual(["a", "b"])
    })

    it("returns a promise with the exception", async () => {
      return expect(
        newGetChildrenBuilder(curator).forPath("/non_exist")
      ).rejects.toMatchObject({
        name: "NO_NODE"
      })
    })

    it("call the passed callback with the results", async () => {
      const cb = {
        onCuratorEvent: jest.fn()
      }

      await newGetChildrenBuilder(curator).withCallback(cb).forPath("/builders")

      expect(cb.onCuratorEvent).toHaveBeenCalledWith(curator, {
        children: ["a", "b"],
        path: "/builders",
        returnCode: ZooKeeperCode.OK,
        stat: expect.anything(),
        type: CuratorEventType.CHILDREN
      })
    })

    it("call the passed callback when there is an error", async () => {
      const cb = {
        onCuratorEvent: jest.fn()
      }

      try {
        await newGetChildrenBuilder(curator)
          .withCallback(cb)
          .forPath("/non_existent")
      } catch (e) {
        // It's going to fail, but we don't care about the result
        // only that the test should not fail here
      }

      expect(cb.onCuratorEvent).toHaveBeenCalledWith(curator, {
        children: undefined,
        path: "/non_existent",
        returnCode: ZooKeeperCode.NONODE,
        stat: undefined,
        type: CuratorEventType.CHILDREN
      })
    })

    it("set a watcher on children change", async () => {
      const watcher = {
        onZooKeeperEvent: jest.fn()
      }

      await newGetChildrenBuilder(curator)
        .withWatcher(watcher)
        .forPath("/builders")
      await zk.create("/builders/c")

      expect(watcher.onZooKeeperEvent).toHaveBeenCalledWith({
        name: "NODE_CHILDREN_CHANGED",
        path: "/builders",
        type: ZooKeeperEventType.NODE_CHILDREN_CHANGED
      })
    })
  })

  describe("GetDataBuilder", () => {
    beforeEach(async () => {
      await zk.create("/builders")
    })

    afterEach(() => {
      return zk.removeRecursive("/builders")
    })

    it("returns a promise with the node data", async () => {
      const data = await newGetDataBuilder(curator).forPath("/builders")

      expect(data).toBeUndefined()
    })

    it("returns a promise with the exception", async () => {
      return expect(
        newGetDataBuilder(curator).forPath("/non_exist")
      ).rejects.toMatchObject({
        name: "NO_NODE"
      })
    })

    it("call the passed callback with the results when there is no data", async () => {
      const cb = {
        onCuratorEvent: jest.fn()
      }

      await newGetDataBuilder(curator).withCallback(cb).forPath("/builders")

      expect(cb.onCuratorEvent).toHaveBeenCalledWith(curator, {
        data: undefined,
        path: "/builders",
        returnCode: ZooKeeperCode.OK,
        stat: expect.anything(),
        type: CuratorEventType.GET_DATA
      })
    })

    it("call the passed callback with the results when there is some data", async () => {
      const cb = {
        onCuratorEvent: jest.fn()
      }

      await zk.setData("/builders", "hey there")
      await newGetDataBuilder(curator).withCallback(cb).forPath("/builders")

      expect(cb.onCuratorEvent).toHaveBeenCalledWith(curator, {
        data: expect.any(Buffer),
        path: "/builders",
        returnCode: ZooKeeperCode.OK,
        stat: expect.anything(),
        type: CuratorEventType.GET_DATA
      })
      expect(cb.onCuratorEvent.mock.calls[0][1].data.toString("utf8")).toEqual(
        "hey there"
      )
    })

    it("call the passed callback when there is an error", async () => {
      const cb = {
        onCuratorEvent: jest.fn()
      }

      try {
        await newGetDataBuilder(curator)
          .withCallback(cb)
          .forPath("/non_existent")
      } catch (e) {
        // It's going to fail, but we don't care about the result
        // only that the test should not fail here
      }

      expect(cb.onCuratorEvent).toHaveBeenCalledWith(curator, {
        data: undefined,
        path: "/non_existent",
        returnCode: ZooKeeperCode.NONODE,
        stat: undefined,
        type: CuratorEventType.GET_DATA
      })
    })

    it("set a watcher on data change", async () => {
      const watcher = {
        onZooKeeperEvent: jest.fn()
      }

      await newGetDataBuilder(curator).withWatcher(watcher).forPath("/builders")
      await zk.setData("/builders", "hey there")

      expect(watcher.onZooKeeperEvent).toHaveBeenCalledWith({
        name: "NODE_DATA_CHANGED",
        path: "/builders",
        type: ZooKeeperEventType.NODE_DATA_CHANGED
      })
    })
  })

  describe("GetExistsBuilder", () => {
    beforeEach(async () => {
      await zk.create("/builders")
    })

    afterEach(() => {
      return zk.removeRecursive("/builders")
    })

    it("returns a promise resolving the node existence", async () => {
      const exist = await newExistsBuilder(curator).forPath("/builders")

      expect(exist).toEqual(true)
    })

    it("returns a promise with the node existence", async () => {
      const exist = await newExistsBuilder(curator).forPath("/non_exist")

      expect(exist).toEqual(false)
    })

    it("reject the promise when fail", async () => {
      const client = createClient("localhost:2181")
      client.connect()
      const curator = new CuratorFrameworkImpl(client)
      await new Promise(resolve => {
        client.once("connected", resolve)
      })

      client.close()
      expect(
        newExistsBuilder(curator).forPath("/builders")
      ).rejects.toMatchObject({
        code: -4,
        name: "CONNECTION_LOSS",
        path: undefined
      })
    })

    it("call the passed callback with the results when there is no node", async () => {
      const cb = {
        onCuratorEvent: jest.fn()
      }

      await newExistsBuilder(curator).withCallback(cb).forPath("/non_existent")

      expect(cb.onCuratorEvent).toHaveBeenCalledWith(curator, {
        path: "/non_existent",
        returnCode: ZooKeeperCode.NONODE,
        stat: null,
        type: CuratorEventType.EXISTS
      })
    })

    it("call the passed callback with the results when there is a node", async () => {
      const cb = {
        onCuratorEvent: jest.fn()
      }

      await newExistsBuilder(curator).withCallback(cb).forPath("/builders")

      expect(cb.onCuratorEvent).toHaveBeenCalledWith(curator, {
        path: "/builders",
        returnCode: ZooKeeperCode.OK,
        stat: expect.anything(),
        type: CuratorEventType.EXISTS
      })
    })

    it("set a watcher on node creation", async () => {
      const watcher = {
        onZooKeeperEvent: jest.fn()
      }

      await newExistsBuilder(curator)
        .withWatcher(watcher)
        .forPath("/builders/c")
      await zk.create("/builders/c")

      expect(watcher.onZooKeeperEvent).toHaveBeenCalledWith({
        name: "NODE_CREATED",
        path: "/builders/c",
        type: ZooKeeperEventType.NODE_CREATED
      })
    })

    it("set a watcher on node deletion", async () => {
      const watcher = {
        onZooKeeperEvent: jest.fn()
      }

      await zk.create("/builders/c")
      await newExistsBuilder(curator)
        .withWatcher(watcher)
        .forPath("/builders/c")
      await zk.remove("/builders/c")

      expect(watcher.onZooKeeperEvent).toHaveBeenCalledWith({
        name: "NODE_DELETED",
        path: "/builders/c",
        type: ZooKeeperEventType.NODE_DELETED
      })
    })
  })
})
