import { listSamplesQuerySchema } from "../src/modules/samples/sample.schema"

describe("listSamplesQuerySchema", () => {
  it("applies defaults when keys are absent", () => {
    expect(listSamplesQuerySchema.parse({})).toEqual({ page: 1, limit: 10 })
  })

  it("coerces numeric strings", () => {
    expect(listSamplesQuerySchema.parse({ page: "3", limit: "20" })).toEqual({
      page: 3,
      limit: 20,
    })
  })

  it("accepts limit 50 and rejects 51", () => {
    expect(listSamplesQuerySchema.safeParse({ limit: "50" }).success).toBe(true)
    expect(listSamplesQuerySchema.safeParse({ limit: "51" }).success).toBe(false)
  })

  it.each([{ page: "0" }, { page: "-1" }, { page: "1.5" }, { limit: "0" }, { limit: "abc" }])(
    "rejects %j",
    (query) => {
      expect(listSamplesQuerySchema.safeParse(query).success).toBe(false)
    },
  )
})
