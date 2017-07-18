import { validatePath } from "../src/PathUtils"

/**
 * Dummy test
 */
describe("Path utils", () => {
  describe("#validatePath", () => {
    it("verify path is not null", () => {
      expect(() => {
        validatePath(null)
      }).toThrow("Path cannot be null")
    })

    it("verify path is non empty", () => {
      expect(() => {
        validatePath("")
      }).toThrow("Path length must be > 0")
    })
  })

  it("verify path start with a slash", () => {
    expect(() => {
      validatePath("s")
    }).toThrow("Path must start with / character")
  })

  it("verify root path pass the validation", () => {
    expect(validatePath("/")).toEqual("/")
  })

  it("verify path must not end with a slash", () => {
    expect(() => {
      validatePath("/something/")
    }).toThrow("Path must not end with / character")
  })

  it("verify path doesn't contains any null character", () => {
    expect(() => {
      validatePath("/root/\0/child")
    }).toThrow(/null character not allowed @6/)
  })

  it("verify path doesn't contains any empty node", () => {
    expect(() => {
      validatePath("/root//child")
    }).toThrow(/empty node name specified @6/)
  })

  it("verify path doesn't contains any relative paths", () => {
    expect(() => {
      validatePath("/root/..")
    }).toThrow(/relative paths not allowed @7/)

    expect(() => {
      validatePath("/root/../root")
    }).toThrow(/relative paths not allowed @7/)

    expect(() => {
      validatePath("/root/./root")
    }).toThrow(/relative paths not allowed @6/)
  })

  it("verify path doesn't contains invalid character", () => {
    ;["\u0001", "\u0008", "\ue000", "\ufff3"].forEach(c => {
      expect(() => {
        validatePath(`/root/${c}/child`)
      }).toThrow(/invalid character @6/)
    })
  })

  it("return verified path", () => {
    expect(validatePath("/root/subnode/child")).toEqual("/root/subnode/child")
  })
})
