import { createClient, Client } from "node-zookeeper-client"
import { ZooKeeperP } from "./TestUtils"

import { mkdirs } from "../src/ZkPaths"

let client: Client
let zk: ZooKeeperP

beforeAll(() => {
  client = createClient("localhost:2181")
  client.connect()
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

describe("ZkPaths", () => {
  beforeEach(() => {
    return zk.exists("/root").then(e => {
      if (e) {
        return zk.removeRecursive("/root")
      } else {
        return Promise.resolve()
      }
    })
  })

  describe("#mkdirs", () => {
    it("create folder with last node", done => {
      mkdirs(client, "/root/a/b/c", true, null, true, async (err, p) => {
        expect(err).toBeNull()
        expect(p).toEqual("/root/a/b/c")

        const exist = await zk.exists("/root/a/b/c")

        expect(exist).toBeDefined()
        done()
      })
    })

    it("create folder without last node", async done => {
      mkdirs(client, "/root/a/b/c", false, null, true, async (err, p) => {
        expect(err).toBeNull()
        expect(p).toEqual("/root/a/b")

        const exist = await zk.exists("/root/a/b")

        expect(exist).toBe(true)
        done()
      })
    })
  })
})
