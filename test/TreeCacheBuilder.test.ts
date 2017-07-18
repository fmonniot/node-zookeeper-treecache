import { consoleLogger, ConsoleLike } from "../src/TreeCacheBuilder"

describe("TreeCacheBuilder", () => {
  let console: ConsoleLike

  beforeEach(() => {
    // We know we will only need this method from console
    console = {
      log: jest.fn()
    }
  })

  describe("consoleLogger", () => {
    it("print debug statement on the console", () => {
      const logger = consoleLogger(0, console)
      logger.debug("msg", [1], "two", [{}])

      expect(console.log).toHaveBeenCalledWith("[0][debug]msg", [1], "two", [
        {}
      ])
    })

    it("print info statement on the console", () => {
      const logger = consoleLogger(0, console)
      logger.info("msg", [1], "two", [{}])

      expect(console.log).toHaveBeenCalledWith("[0][info]msg", [1], "two", [{}])
    })

    it("print warn statement on the console", () => {
      const logger = consoleLogger(0, console)
      logger.warn("msg", [1], "two", [{}])

      expect(console.log).toHaveBeenCalledWith("[0][warn]msg", [1], "two", [{}])
    })

    it("print error statement on the console", () => {
      const logger = consoleLogger(0, console)
      logger.error("msg", [1], "two", [{}])

      expect(console.log).toHaveBeenCalledWith("[0][error]msg", [1], "two", [
        {}
      ])
    })
  })
})
