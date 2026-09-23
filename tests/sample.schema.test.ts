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

  describe("filters", () => {
    it("leaves status, site and studyId undefined when absent", () => {
      const parsed = listSamplesQuerySchema.parse({})
      expect(parsed.status).toBeUndefined()
      expect(parsed.site).toBeUndefined()
      expect(parsed.studyId).toBeUndefined()
    })

    it("splits comma-separated values and trims whitespace", () => {
      expect(listSamplesQuerySchema.parse({ status: "collected,received" }).status).toEqual([
        "collected",
        "received",
      ])
      expect(listSamplesQuerySchema.parse({ site: " Pune , Delhi " }).site).toEqual([
        "Pune",
        "Delhi",
      ])
    })

    it("flattens repeated keys (array input) and splits each entry", () => {
      const parsed = listSamplesQuerySchema.parse({ studyId: ["study-001,study-002", "study-003"] })
      expect(parsed.studyId).toEqual(["study-001", "study-002", "study-003"])
    })

    it("rejects an unknown status token", () => {
      expect(listSamplesQuerySchema.safeParse({ status: "collected,lost" }).success).toBe(false)
    })

    it.each(["status", "site", "studyId"])("rejects empty tokens for %s", (field) => {
      for (const value of ["", "a,", ",", "a,,b"]) {
        expect(listSamplesQuerySchema.safeParse({ [field]: value }).success).toBe(false)
      }
    })

    it.each([{ site: { a: "b" } }, { site: [{}] }, { status: 5 }])(
      "rejects non-string input %j",
      (query) => {
        expect(listSamplesQuerySchema.safeParse(query).success).toBe(false)
      },
    )
  })

  describe("search", () => {
    it("is undefined when absent", () => {
      expect(listSamplesQuerySchema.parse({}).search).toBeUndefined()
    })

    it("trims surrounding whitespace and preserves case", () => {
      expect(listSamplesQuerySchema.parse({ search: "  PuNe " }).search).toBe("PuNe")
    })

    it("keeps inner whitespace", () => {
      expect(listSamplesQuerySchema.parse({ search: "New Delhi" }).search).toBe("New Delhi")
    })

    it.each(["", "   "])("rejects empty or whitespace-only %j", (search) => {
      expect(listSamplesQuerySchema.safeParse({ search }).success).toBe(false)
    })

    it("accepts 100 characters and rejects 101", () => {
      expect(listSamplesQuerySchema.safeParse({ search: "x".repeat(100) }).success).toBe(true)
      expect(listSamplesQuerySchema.safeParse({ search: "x".repeat(101) }).success).toBe(false)
    })

    it("rejects an array (repeated key)", () => {
      expect(listSamplesQuerySchema.safeParse({ search: ["a", "b"] }).success).toBe(false)
    })

    it("rejects non-string input", () => {
      expect(listSamplesQuerySchema.safeParse({ search: { a: "b" } }).success).toBe(false)
    })
  })

  describe("sorting", () => {
    it("leaves sortBy and order undefined when absent, without adding defaults", () => {
      const parsed = listSamplesQuerySchema.parse({})
      expect(parsed.sortBy).toBeUndefined()
      expect(parsed.order).toBeUndefined()
      expect(parsed).toEqual({ page: 1, limit: 10 })
    })

    it.each(["collectedAt", "sampleCode", "volumeMl", "status"])("accepts sortBy %s", (sortBy) => {
      expect(listSamplesQuerySchema.parse({ sortBy }).sortBy).toBe(sortBy)
    })

    it.each(["asc", "desc"])("accepts order %s", (order) => {
      expect(listSamplesQuerySchema.parse({ order }).order).toBe(order)
    })

    it.each([{ sortBy: "site" }, { sortBy: "id" }, { sortBy: "VOLUMEML" }, { sortBy: "" }])(
      "rejects unknown sortBy %j",
      (query) => {
        expect(listSamplesQuerySchema.safeParse(query).success).toBe(false)
      },
    )

    it.each([{ order: "up" }, { order: "ASC" }, { order: "" }])(
      "rejects unknown order %j",
      (query) => {
        expect(listSamplesQuerySchema.safeParse(query).success).toBe(false)
      },
    )

    it("rejects arrays (repeated keys) for both fields", () => {
      expect(listSamplesQuerySchema.safeParse({ sortBy: ["status", "volumeMl"] }).success).toBe(
        false,
      )
      expect(listSamplesQuerySchema.safeParse({ order: ["asc", "desc"] }).success).toBe(false)
    })

    it("accepts order without sortBy", () => {
      expect(listSamplesQuerySchema.safeParse({ order: "desc" }).success).toBe(true)
    })
  })
})
