import { createClient, Client } from "node-zookeeper-client"
import { ZooKeeperP, timeout } from "./TestUtils"

import {
  treeCacheBuilder,
  TreeCache,
  TreeCacheBuilder,
  TreeCacheEventType,
  TreeCacheEvent
} from "../src/node-zk-treecache"
import * as child_process from "child_process"

let client: Client
let zk: ZooKeeperP

// beforeAll(() => {
//   client = createClient('localhost:2181').setMaxListeners(15)
//   client.connect()
//
//   zk = new ZooKeeperP(client)
//
//   return new Promise<void>((resolve) => {
//     client.once('connected', () => {
//       resolve()
//     })
//   })
// })

// afterAll(() => {
//   client.close()
// })

const noOpLogger = {
  id: 0,

  debug() {
    return
  },

  info() {
    return
  },

  warn() {
    return
  },

  error() {
    return
  }
}

/**
 * End to end test suite for the TreeCache.
 * It needs access to a ZooKeeper instance on localhost:2181
 */
describe("public interface", () => {
  beforeEach(() => {
    console.log("pid = ", process.pid)
    client = createClient("localhost:2181").setMaxListeners(15)
    client.connect()
    zk = new ZooKeeperP(client)

    return new Promise<void>(resolve =>
      client.once("connected", resolve)
    ).then(() =>
      zk.exists("/root").then(e => {
        if (e) {
          return zk.removeRecursive("/root")
        } else {
          return Promise.resolve()
        }
      })
    )
  })

  afterEach(() => {
    events = []
    client.close()
  })

  let events: TreeCacheEvent[] = []

  const buildWithListener = (builder: TreeCacheBuilder) => {
    return new Promise<TreeCache>(resolve => {
      const cache = builder.withLogger(noOpLogger).build()

      cache.addListener((c, e) => {
        // console.log(`[${e.date.toISOString()}] CLIENT LISTENER RECEIVED =/= ${e.type} on ${e.path}`)
        events.push(e)
        if (e.type === TreeCacheEventType.INITIALIZED) {
          resolve(cache)
        }
      })

      return cache.start()
    })
  }

  const assertEvent = (t: TreeCacheEventType, path?: string, data?: string) => {
    const event = events.shift()

    expect(event).toBeDefined()
    expect(event.type).toBe(t)

    if (path) expect(event.path).toBe(path)
    if (data) expect(event.data.data.toString("utf8")).toBe(data)
  }

  const assertNoMoreEvents = () => {
    expect(events).toHaveLength(0)
  }

  test("selector", async () => {
    await zk.create("/root")
    await zk.create("/root/n1-a")
    await zk.create("/root/n1-b")
    await zk.create("/root/n1-b/n2-a")
    await zk.create("/root/n1-b/n2-b")
    await zk.create("/root/n1-b/n2-b/n3-a")
    await zk.create("/root/n1-c")
    await zk.create("/root/n1-d")

    const selector = {
      traverseChildren(fullPath: string): boolean {
        return fullPath !== "/root/n1-b/n2-b"
      },

      acceptChild(fullPath: string): boolean {
        return fullPath !== "/root/n1-c"
      }
    }

    let treeCache = await buildWithListener(
      treeCacheBuilder(client, "/root").withSelector(selector)
    )

    assertEvent(TreeCacheEventType.NODE_ADDED, "/root")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/n1-a")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/n1-b")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/n1-d")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/n1-b/n2-a")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/n1-b/n2-b")
    assertEvent(TreeCacheEventType.INITIALIZED)
    assertNoMoreEvents()

    treeCache.close()
  })

  test("startup", async () => {
    await zk.create("/root")
    await zk.create("/root/1", "one")
    await zk.create("/root/2", "two")
    await zk.create("/root/3", "three")
    await zk.create("/root/2/sub", "two-sub")

    let treeCache = await buildWithListener(treeCacheBuilder(client, "/root"))

    assertEvent(TreeCacheEventType.NODE_ADDED, "/root")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/1", "one")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/2", "two")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/3", "three")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/2/sub", "two-sub")
    assertEvent(TreeCacheEventType.INITIALIZED)
    assertNoMoreEvents()

    expect(Array.from(treeCache.getCurrentChildren("/root").keys())).toEqual([
      "1",
      "2",
      "3"
    ])
    expect(
      Array.from(treeCache.getCurrentChildren("/root/1").keys())
    ).toHaveLength(0)
    expect(Array.from(treeCache.getCurrentChildren("/root/2").keys())).toEqual([
      "sub"
    ])
    expect(treeCache.getCurrentChildren("/root/non_exist")).toBeNull()

    treeCache.close()
  })

  test("create parents", async () => {
    let treeCache = await buildWithListener(treeCacheBuilder(client, "/root"))
    assertEvent(TreeCacheEventType.INITIALIZED)
    assertNoMoreEvents()
    treeCache.close()

    treeCache = await buildWithListener(
      treeCacheBuilder(client, "/root/two/three").withCreateParentNodes(true)
    )
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/two/three")
    assertEvent(TreeCacheEventType.INITIALIZED)
    assertNoMoreEvents()
    treeCache.close()

    const exist = await zk.exists("/root/two/three")
    expect(exist).toBe(true)
  })

  test("start empty", async () => {
    let treeCache = await buildWithListener(treeCacheBuilder(client, "/root"))

    assertEvent(TreeCacheEventType.INITIALIZED)
    assertNoMoreEvents()

    await zk.create("/root")

    await timeout(1)

    assertEvent(TreeCacheEventType.NODE_ADDED, "/root")
    assertNoMoreEvents()

    treeCache.close()
  })

  test("start empty deeper", async () => {
    let treeCache = await buildWithListener(
      treeCacheBuilder(client, "/root/foo/bar")
    )

    assertEvent(TreeCacheEventType.INITIALIZED)
    assertNoMoreEvents()

    await zk.create("/root")
    await zk.create("/root/foo")
    await timeout(1)

    assertNoMoreEvents()

    await zk.create("/root/foo/bar")
    await timeout(1)

    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/foo/bar")
    assertNoMoreEvents()

    treeCache.close()
  })

  test("depth 0", async () => {
    await zk.create("/root")
    await zk.create("/root/1", "one")
    await zk.create("/root/2", "two")
    await zk.create("/root/3", "three")
    await zk.create("/root/2/sub", "two-sub")

    let treeCache = await buildWithListener(
      treeCacheBuilder(client, "/root").withMaxDepth(0)
    )

    assertEvent(TreeCacheEventType.NODE_ADDED, "/root")
    assertEvent(TreeCacheEventType.INITIALIZED)
    assertNoMoreEvents()

    expect(Array.from(treeCache.getCurrentChildren("/root").keys())).toEqual([])
    expect(treeCache.getCurrentData("/root/1")).toBeNull()
    expect(treeCache.getCurrentChildren("/root/1")).toBeNull()
    expect(treeCache.getCurrentData("/root/non_exist")).toBeNull()

    treeCache.close()
  })

  test("depth 1", async () => {
    await zk.create("/root")
    await zk.create("/root/1", "one")
    await zk.create("/root/2", "two")
    await zk.create("/root/3", "three")
    await zk.create("/root/2/sub", "two-sub")

    let treeCache = await buildWithListener(
      treeCacheBuilder(client, "/root").withMaxDepth(1)
    )

    assertEvent(TreeCacheEventType.NODE_ADDED, "/root")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/1", "one")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/2", "two")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/3", "three")
    assertEvent(TreeCacheEventType.INITIALIZED)
    assertNoMoreEvents()

    expect(Array.from(treeCache.getCurrentChildren("/root").keys())).toEqual([
      "1",
      "2",
      "3"
    ])
    expect(Array.from(treeCache.getCurrentChildren("/root/1").keys())).toEqual(
      []
    )
    expect(Array.from(treeCache.getCurrentChildren("/root/2").keys())).toEqual(
      []
    )
    expect(Array.from(treeCache.getCurrentChildren("/root/3").keys())).toEqual(
      []
    )
    expect(treeCache.getCurrentData("/root/2/sub")).toBeNull()
    expect(treeCache.getCurrentChildren("/root/2/sub")).toBeNull()
    expect(treeCache.getCurrentData("/root/non_exist")).toBeNull()

    treeCache.close()
  })

  test("depth 1 deeper", async () => {
    await zk.create("/root")
    await zk.create("/root/foo")
    await zk.create("/root/foo/bar")
    await zk.create("/root/foo/bar/1", "one")
    await zk.create("/root/foo/bar/2", "two")
    await zk.create("/root/foo/bar/3", "three")
    await zk.create("/root/foo/bar/2/sub", "two-sub")

    let treeCache = await buildWithListener(
      treeCacheBuilder(client, "/root/foo/bar").withMaxDepth(1)
    )

    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/foo/bar")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/foo/bar/1", "one")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/foo/bar/2", "two")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/foo/bar/3", "three")
    assertEvent(TreeCacheEventType.INITIALIZED)
    assertNoMoreEvents()

    treeCache.close()
  })

  test("from root", async () => {
    await zk.create("/root")
    await zk.create("/root/one", "hey there")

    let treeCache = await buildWithListener(treeCacheBuilder(client, "/"))

    // Here we have to account for the special key /zookeeper/quota in our test case
    assertEvent(TreeCacheEventType.NODE_ADDED, "/")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/zookeeper")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/one", "hey there")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/zookeeper/quota")
    assertEvent(TreeCacheEventType.INITIALIZED)
    assertNoMoreEvents()

    expect(Array.from(treeCache.getCurrentChildren("/").keys())).toEqual([
      "root",
      "zookeeper"
    ])
    expect(Array.from(treeCache.getCurrentChildren("/root").keys())).toEqual([
      "one"
    ])
    expect(
      Array.from(treeCache.getCurrentChildren("/root/one").keys())
    ).toEqual([])
    expect(treeCache.getCurrentData("/root/one").data).toBeDefined()
    expect(treeCache.getCurrentData("/root/one").data.toString("utf8")).toEqual(
      "hey there"
    )

    treeCache.close()
  })

  test("from root with depth", async () => {
    await zk.create("/root")
    await zk.create("/root/one", "hey there")

    let treeCache = await buildWithListener(
      treeCacheBuilder(client, "/").withMaxDepth(1)
    )

    // Here we have to account for the special key /zookeeper/quota in our test case
    assertEvent(TreeCacheEventType.NODE_ADDED, "/")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/zookeeper")
    assertEvent(TreeCacheEventType.INITIALIZED)
    assertNoMoreEvents()

    expect(Array.from(treeCache.getCurrentChildren("/").keys())).toEqual([
      "root",
      "zookeeper"
    ])
    expect(Array.from(treeCache.getCurrentChildren("/root").keys())).toEqual([])
    expect(treeCache.getCurrentData("/root/one")).toBeNull()
    expect(treeCache.getCurrentChildren("/root/one")).toBeNull()

    treeCache.close()
  })

  test("initial population", async () => {
    let treeCache = await buildWithListener(treeCacheBuilder(client, "/root"))

    assertEvent(TreeCacheEventType.INITIALIZED)
    assertNoMoreEvents()

    await zk.create("/root")
    await zk.create("/root/one", "hey there")

    // Needs to wait a bit longer as we have to wait for two round trip to ZK
    // the first for a CHILDREN on /root and the second for a CHILDREN on /root/one
    await timeout(10)

    assertEvent(TreeCacheEventType.NODE_ADDED, "/root")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/one", "hey there")
    assertNoMoreEvents()

    treeCache.close()
  })

  test("children initialized", async () => {
    await zk.create("/root")
    await zk.create("/root/1", "1")
    await zk.create("/root/2", "2")
    await zk.create("/root/3", "3")

    let treeCache = await buildWithListener(treeCacheBuilder(client, "/root"))

    // Needs to wait a bit longer as we have to wait for multiple round trip to ZK
    // the first for a CHILDREN on /root and then for a CHILDREN on each subnode

    assertEvent(TreeCacheEventType.NODE_ADDED, "/root")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/1", "1")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/2", "2")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/3", "3")
    assertEvent(TreeCacheEventType.INITIALIZED)
    assertNoMoreEvents()

    treeCache.close()
  })

  test("update when not caching", async () => {
    await zk.create("/root")

    let treeCache = await buildWithListener(
      treeCacheBuilder(client, "/root").withCacheData(false)
    )

    assertEvent(TreeCacheEventType.NODE_ADDED, "/root")
    assertEvent(TreeCacheEventType.INITIALIZED)

    await zk.create("/root/foo", "first")
    await timeout(5)
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/foo")

    await zk.setData("/root/foo", "something new")
    await timeout(5)
    assertEvent(TreeCacheEventType.NODE_UPDATED, "/root/foo")

    assertNoMoreEvents()

    expect(treeCache.getCurrentData("/root/foo")).toBeDefined()
    expect(treeCache.getCurrentData("/root/foo").data).toBeUndefined()

    treeCache.close()
  })

  // TODO Investigate why we publish twice the NODE_REMOVED event
  // This is not a blocker though
  test("delete then create", async () => {
    await zk.create("/root")
    await zk.create("/root/foo", "one")

    let treeCache = await buildWithListener(
      treeCacheBuilder(client, "/root").withCacheData(false)
    )

    assertEvent(TreeCacheEventType.NODE_ADDED, "/root")
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/foo")
    assertEvent(TreeCacheEventType.INITIALIZED)

    await zk.remove("/root/foo")
    await timeout(5)
    assertEvent(TreeCacheEventType.NODE_REMOVED, "/root/foo")
    assertEvent(TreeCacheEventType.NODE_REMOVED)
    await zk.create("/root/foo", "two")
    await timeout(5)
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/foo", "two")

    await zk.remove("/root/foo")
    await timeout(5)
    assertEvent(TreeCacheEventType.NODE_REMOVED, "/root/foo")
    assertEvent(TreeCacheEventType.NODE_REMOVED)
    await zk.create("/root/foo", "three")
    await timeout(5)
    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/foo", "three")

    assertNoMoreEvents()
    treeCache.close()
  })

  // TODO Investigate why the root node was not deleted (or at least why it publish UPDATE instead of ADDED)
  // TODO Also why is there four NODE_REMOVED events emitted ? And the three last don't have the data property set.
  test("delete then create root", async () => {
    await zk.create("/root")
    await zk.create("/root/foo", "one")

    let treeCache = await buildWithListener(
      treeCacheBuilder(client, "/root/foo").withCacheData(false)
    )

    assertEvent(TreeCacheEventType.NODE_ADDED, "/root/foo")
    assertEvent(TreeCacheEventType.INITIALIZED)

    await zk.remove("/root/foo")
    await timeout(5)
    assertEvent(TreeCacheEventType.NODE_REMOVED, "/root/foo")
    assertEvent(TreeCacheEventType.NODE_REMOVED)
    await zk.create("/root/foo", "two")
    await timeout(5)
    assertEvent(TreeCacheEventType.NODE_UPDATED, "/root/foo", "two")

    await zk.remove("/root/foo")
    assertEvent(TreeCacheEventType.NODE_REMOVED, "/root/foo")
    assertEvent(TreeCacheEventType.NODE_REMOVED)
    assertEvent(TreeCacheEventType.NODE_REMOVED)
    assertEvent(TreeCacheEventType.NODE_REMOVED)
    await zk.create("/root/foo", "three")
    await timeout(5)
    assertEvent(TreeCacheEventType.NODE_UPDATED, "/root/foo", "three")

    assertNoMoreEvents()
    treeCache.close()
  })

  test(
    "server down and up",
    async () => {
      const client = createClient("localhost:2181")
      const zk = new ZooKeeperP(client)
      client.connect()

      let treeCache = await buildWithListener(treeCacheBuilder(client, "/root"))

      assertEvent(TreeCacheEventType.INITIALIZED)
      assertNoMoreEvents()

      await zk.create("/root")
      await zk.create("/root/a")
      await timeout(5)

      assertEvent(TreeCacheEventType.NODE_ADDED, "/root")
      assertEvent(TreeCacheEventType.NODE_ADDED, "/root/a")
      assertNoMoreEvents()

      function exec(cmd: string) {
        return new Promise<string[]>((resolve, reject) => {
          child_process.exec(cmd, (err, stdout, stderr) => {
            if (err) reject(err)
            else resolve([stdout, stderr])
          })
        })
      }

      const [stdout, stderr] = await exec("docker stop some-zookeeper")
      await timeout(1000)

      assertEvent(TreeCacheEventType.CONNECTION_SUSPENDED)
      assertNoMoreEvents()

      const [stdout2, stderr2] = await exec("docker start some-zookeeper")
      await timeout(5000)

      assertEvent(TreeCacheEventType.CONNECTION_RECONNECTED)
      assertNoMoreEvents()

      treeCache.close()
      client.close()
    },
    15000
  ) // timeout is 15s

  test(
    "killed session",
    async () => {
      const client = createClient("localhost:2181")
      client.connect()

      let treeCache = await buildWithListener(treeCacheBuilder(client, "/root"))

      assertEvent(TreeCacheEventType.INITIALIZED)
      assertNoMoreEvents()

      client.close()
      await timeout(100)

      assertEvent(TreeCacheEventType.CONNECTION_SUSPENDED)
      assertNoMoreEvents()

      treeCache.close()
    },
    15000
  ) // timeout is 15s

  // Make sure TreeCache gets to a sane state when we can't initially connect to server.
  test.skip("server not started yet", () => {
    pending("until found a way to start/stop the server in the test itself")
  })

  test("error listener", async () => {
    await zk.create("/root")

    let treeCache = await buildWithListener(treeCacheBuilder(client, "/root"))

    assertEvent(TreeCacheEventType.NODE_ADDED, "/root")
    assertEvent(TreeCacheEventType.INITIALIZED)

    treeCache.addListener((c, e) => {
      if (e.type === TreeCacheEventType.NODE_UPDATED) {
        throw new Error("Test exception")
      }
    })

    // Add listener

    const errorListener = jest.fn()
    treeCache.addErrorListener(errorListener)

    await zk.setData("/root", "hey there")
    await timeout(50)

    assertEvent(TreeCacheEventType.NODE_UPDATED, "/root", "hey there")
    assertNoMoreEvents()

    expect(errorListener).toHaveBeenCalledWith("", new Error("Test exception"))

    // Remove listener

    treeCache.removeErrorListener(errorListener)

    await zk.setData("/root", "two")
    await timeout(50)

    assertEvent(TreeCacheEventType.NODE_UPDATED, "/root", "two")
    assertNoMoreEvents()

    expect(errorListener).toHaveBeenCalledTimes(1)

    treeCache.close()
  })

  test("listener", async () => {
    await zk.create("/root")

    let treeCache = await buildWithListener(treeCacheBuilder(client, "/root"))

    assertEvent(TreeCacheEventType.NODE_ADDED, "/root")
    assertEvent(TreeCacheEventType.INITIALIZED)

    const listener = jest.fn()

    // Add listener

    treeCache.addListener(listener)

    await zk.setData("/root", "hey there")
    await timeout(50)

    assertEvent(TreeCacheEventType.NODE_UPDATED, "/root", "hey there")
    assertNoMoreEvents()

    expect(listener).toHaveBeenCalledWith(expect.anything(), {
      _type: TreeCacheEventType.NODE_UPDATED,
      _data: {
        path: "/root",
        stat: expect.anything(),
        data: expect.any(Buffer)
      },
      _date: expect.any(Date)
    })

    // Remove listener

    treeCache.removeListener(listener)

    await zk.setData("/root", "two")
    await timeout(50)

    assertEvent(TreeCacheEventType.NODE_UPDATED, "/root", "two")
    assertNoMoreEvents()

    expect(listener).toHaveBeenCalledTimes(1)

    treeCache.close()
  })
})
