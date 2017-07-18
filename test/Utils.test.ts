import { checkNotNull } from "../src/Utils"

describe("#checkNotNul", () => {
  it("throw when argument is null", () => {
    expect(() => {
      checkNotNull(null, "message")
    }).toThrow("message")
  })

  it("don't throw when argument is non null", () => {
    expect(() => {
      checkNotNull(undefined, "message")
    }).not.toThrow("message")

    expect(() => {
      checkNotNull("", "message")
    }).not.toThrow("message")
  })
})
