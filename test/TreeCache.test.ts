import {
  ChildData,
  compareChildData,
  TreeCacheEvent,
  TreeCacheEventType,
  ZooKeeperStat
} from "../src/TreeCache"

const mkStat = (stat: object = {}) =>
  Object.assign(
    {
      czxid: Buffer.alloc(2, "cz", "ascii"),
      mzxid: Buffer.alloc(2, "mz", "ascii"),
      ctime: Buffer.alloc(2, "ct", "ascii"),
      mtime: Buffer.alloc(2, "mt", "ascii"),
      version: 1,
      cversion: 2,
      aversion: 3,
      ephemeralOwner: Buffer.alloc(2, "eo", "ascii"),
      dataLength: 4,
      numChildren: 5,
      pzxid: Buffer.alloc(2, "pz", "ascii")
    },
    stat
  )

const mkChildData = (data: object = {}) =>
  Object.assign(
    {
      path: "/path",
      stat: mkStat(),
      data: Buffer.alloc(4, "data", "ascii")
    },
    data
  )

describe("TreeCache", () => {
  describe("compareChildData", () => {
    it("returns true when same reference", () => {
      const c = mkChildData()

      expect(compareChildData(c, c)).toEqual(true)
      expect(compareChildData(null, null)).toEqual(true)
    })

    it("returns false when data is different", () => {
      expect(
        compareChildData(mkChildData({ data: undefined }), mkChildData())
      ).toEqual(false)
      expect(
        compareChildData(mkChildData(), mkChildData({ data: undefined }))
      ).toEqual(false)
      expect(
        compareChildData(
          mkChildData({ data: Buffer.from([0o02]) }),
          mkChildData()
        )
      ).toEqual(false)
    })

    it("returns false when path is different", () => {
      expect(
        compareChildData(
          mkChildData({ path: "/" }),
          mkChildData({ path: "/2" })
        )
      ).toEqual(false)
    })

    it("returns false when stat is different", () => {
      const compareStatBuffer = (prop: string, v1: any, v2: any) => {
        expect(
          compareChildData(
            mkChildData({ stat: mkStat({ [prop]: Buffer.from([v1]) }) }),
            mkChildData({ stat: mkStat({ [prop]: Buffer.from([v2]) }) })
          )
        ).toEqual(false)
      }

      compareStatBuffer("czxid", 0o01, 0o02)
      compareStatBuffer("mzxid", 0o01, 0o02)
      compareStatBuffer("ctime", 0o01, 0o02)
      compareStatBuffer("mtime", 0o01, 0o02)
      compareStatBuffer("ephemeralOwner", 0o01, 0o02)
      compareStatBuffer("pzxid", 0o01, 0o02)

      const compareStatNumber = (prop: string, v1: number, v2: number) => {
        expect(
          compareChildData(
            mkChildData({ stat: mkStat({ [prop]: v1 }) }),
            mkChildData({ stat: mkStat({ [prop]: v2 }) })
          )
        ).toEqual(false)
      }

      compareStatNumber("version", 1, 2)
      compareStatNumber("cversion", 1, 2)
      compareStatNumber("aversion", 1, 2)
      compareStatNumber("dataLength", 1, 2)
      compareStatNumber("numChildren", 1, 2)
    })

    it("returns true when the child are the same", () => {
      expect(compareChildData(mkChildData(), mkChildData())).toEqual(true)
    })
  })

  describe("TreeCacheEvent", () => {
    it("provides basic getter", () => {
      const date = new Date()
      let child = mkChildData()
      let e = new TreeCacheEvent(TreeCacheEventType.NODE_UPDATED, child, date)

      expect(e.type).toEqual(TreeCacheEventType.NODE_UPDATED)
      expect(e.data).toEqual(child)
      expect(e.path).toEqual(child.path)
      expect(e.date).toEqual(date)
    })

    it("provides a nice string representation", () => {
      expect(
        new TreeCacheEvent(
          TreeCacheEventType.NODE_UPDATED,
          mkChildData(),
          new Date()
        ).toString()
      ).toEqual(
        "TreeCacheEvent { type = 1, path = /path, data = {" +
          '"path":"/path","stat":"defined","data":{"type":"Buffer","data":[100,97,116,97]}' +
          "} }"
      )
      expect(
        new TreeCacheEvent(
          TreeCacheEventType.NODE_UPDATED,
          null,
          new Date()
        ).toString()
      ).toEqual("TreeCacheEvent { type = 1, path = null, data = undefined }")
    })
  })
})
