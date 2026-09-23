import request from "supertest"
import { createApp } from "../src/app"
import { createInMemorySampleRepository } from "../src/modules/samples/sample.repository"
import { buildSeedSamples } from "../src/modules/samples/sample.seed"
import { SAMPLE_STATUSES } from "../src/modules/samples/sample.types"
import type { Sample } from "../src/modules/samples/sample.types"

const buildApp = () => createApp({ sampleRepository: createInMemorySampleRepository() })

let app: ReturnType<typeof buildApp>

beforeEach(() => {
  app = buildApp() // fresh seed data for every test
})

const validPayload = {
  sampleCode: "SMP-900",
  studyId: "study-001",
  type: "blood",
  site: "Pune",
  volumeMl: 2.5,
}

describe("GET /api/v1/samples", () => {
  it("returns the list of samples", async () => {
    const res = await request(app).get("/api/v1/samples")
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThan(0)
  })
})

describe("GET /api/v1/samples pagination", () => {
  const ids = (body: { data: { id: number }[] }) => body.data.map((s) => s.id)

  it("defaults to page 1, limit 10 and returns a meta block", async () => {
    const res = await request(app).get("/api/v1/samples")
    expect(res.status).toBe(200)
    expect(res.body.meta).toEqual({ page: 1, limit: 10, total: 60, totalPages: 6 })
    expect(ids(res.body)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it("honours page and limit", async () => {
    const res = await request(app).get("/api/v1/samples?page=2&limit=5")
    expect(res.status).toBe(200)
    expect(ids(res.body)).toEqual([6, 7, 8, 9, 10])
    expect(res.body.meta).toEqual({ page: 2, limit: 5, total: 60, totalPages: 12 })
  })

  it("returns a full last page and a partial last page", async () => {
    const full = await request(app).get("/api/v1/samples?page=6&limit=10")
    expect(ids(full.body)).toHaveLength(10)
    expect(full.body.data[9].id).toBe(60)

    const partial = await request(app).get("/api/v1/samples?page=3&limit=25")
    expect(ids(partial.body)).toHaveLength(10)
    expect(partial.body.meta.totalPages).toBe(3)
  })

  it("returns 200 with empty data for a page past the end", async () => {
    const res = await request(app).get("/api/v1/samples?page=7")
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
    expect(res.body.meta).toEqual({ page: 7, limit: 10, total: 60, totalPages: 6 })
  })

  it("accepts the maximum limit of 50", async () => {
    const res = await request(app).get("/api/v1/samples?limit=50")
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(50)
    expect(res.body.meta.totalPages).toBe(2)
  })

  it.each([
    ["limit above the max", "limit=51"],
    ["limit of zero", "limit=0"],
    ["empty limit", "limit="],
    ["page of zero", "page=0"],
    ["negative page", "page=-1"],
    ["non-numeric page", "page=abc"],
    ["fractional page", "page=1.5"],
    ["repeated page param", "page=1&page=2"],
  ])("returns 400 for %s", async (_label, query) => {
    const res = await request(app).get(`/api/v1/samples?${query}`)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
  })

  it("reflects creates and deletes in meta.total", async () => {
    await request(app).post("/api/v1/samples").send(validPayload)
    expect((await request(app).get("/api/v1/samples")).body.meta.total).toBe(61)

    await request(app).delete("/api/v1/samples/1")
    await request(app).delete("/api/v1/samples/2")
    expect((await request(app).get("/api/v1/samples")).body.meta.total).toBe(59)
  })
})

describe("GET /api/v1/samples filters", () => {
  const seed = buildSeedSamples()
  const ids = (body: { data: { id: number }[] }) => body.data.map((s) => s.id)

  it("filters by status", async () => {
    const expected = seed.filter((s) => s.status === "collected")
    const res = await request(app).get("/api/v1/samples?status=collected&limit=50")
    expect(res.status).toBe(200)
    expect(ids(res.body)).toEqual(expected.map((s) => s.id))
    expect(res.body.data.every((s: { status: string }) => s.status === "collected")).toBe(true)
    expect(res.body.meta.total).toBe(expected.length)
  })

  it("treats comma-separated and repeated params the same", async () => {
    const comma = await request(app).get("/api/v1/samples?status=collected,received&limit=50")
    const repeated = await request(app).get(
      "/api/v1/samples?status=collected&status=received&limit=50",
    )
    expect(comma.status).toBe(200)
    expect(repeated.body).toEqual(comma.body)
    expect(comma.body.meta.total).toBe(
      seed.filter((s) => ["collected", "received"].includes(s.status)).length,
    )
  })

  it("ANDs filters across fields", async () => {
    const expected = seed.filter(
      (s) => ["Pune", "Delhi"].includes(s.site) && s.studyId === "study-001",
    )
    const res = await request(app).get("/api/v1/samples?site=Pune,Delhi&studyId=study-001&limit=50")
    expect(res.status).toBe(200)
    expect(ids(res.body)).toEqual(expected.map((s) => s.id))
    expect(res.body.meta.total).toBe(expected.length)
  })

  it("paginates the filtered set", async () => {
    const expected = seed.filter((s) => s.status === "collected")
    const res = await request(app).get("/api/v1/samples?status=collected&limit=2&page=2")
    expect(ids(res.body)).toEqual(expected.slice(2, 4).map((s) => s.id))
    expect(res.body.meta).toEqual({
      page: 2,
      limit: 2,
      total: expected.length,
      totalPages: Math.ceil(expected.length / 2),
    })
  })

  it("returns 200 with empty data when nothing matches", async () => {
    const res = await request(app).get("/api/v1/samples?site=Nowhere")
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
    expect(res.body.meta.total).toBe(0)
  })

  it.each([
    ["unknown status", "status=lost"],
    ["empty status", "status="],
    ["empty site", "site="],
    ["trailing comma", "studyId=a,"],
    ["nested key", "status[a]=b"],
  ])("returns 400 for %s", async (_label, query) => {
    const res = await request(app).get(`/api/v1/samples?${query}`)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
  })

  it("reflects creates and status updates in filtered results", async () => {
    const collected = seed.filter((s) => s.status === "collected").length
    await request(app).post("/api/v1/samples").send(validPayload) // defaults to "collected"
    const afterCreate = await request(app).get("/api/v1/samples?status=collected")
    expect(afterCreate.body.meta.total).toBe(collected + 1)

    await request(app).patch("/api/v1/samples/1/status").send({ status: "rejected" })
    const rejected = await request(app).get("/api/v1/samples?status=rejected&limit=50")
    expect(ids(rejected.body)).toContain(1)
    const inTesting = await request(app).get("/api/v1/samples?status=in_testing&limit=50")
    expect(ids(inTesting.body)).not.toContain(1)
  })
})

describe("GET /api/v1/samples search", () => {
  const seed = buildSeedSamples()
  const ids = (body: { data: { id: number }[] }) => body.data.map((s) => s.id)
  const get = (query: string) => request(app).get(`/api/v1/samples?limit=50&${query}`)

  it("matches a substring of sampleCode", async () => {
    const expected = seed.filter((s) => s.sampleCode.includes("SMP-00"))
    const res = await get("search=SMP-00")
    expect(res.status).toBe(200)
    expect(ids(res.body)).toEqual(expected.map((s) => s.id))
    expect(res.body.meta.total).toBe(expected.length)
  })

  it("matches a substring of site", async () => {
    const res = await get("search=Pun")
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThan(0)
    expect(res.body.data.every((s: { site: string }) => s.site === "Pune")).toBe(true)
  })

  it("is case-sensitive", async () => {
    const res = await get("search=pune")
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
    expect(res.body.meta.total).toBe(0)
  })

  it("combines with filters", async () => {
    const expected = seed.filter((s) => s.sampleCode.includes("SMP-00") && s.site === "Pune")
    expect(expected.length).toBeGreaterThan(0)
    const res = await get("search=SMP-00&site=Pune")
    expect(ids(res.body)).toEqual(expected.map((s) => s.id))
  })

  it("paginates the searched set", async () => {
    const expected = seed.filter((s) => s.site.includes("Pun"))
    const res = await request(app).get("/api/v1/samples?search=Pun&limit=5&page=2")
    expect(ids(res.body)).toEqual(expected.slice(5, 10).map((s) => s.id))
    expect(res.body.meta).toEqual({
      page: 2,
      limit: 5,
      total: expected.length,
      totalPages: Math.ceil(expected.length / 5),
    })
  })

  it("trims surrounding whitespace", async () => {
    const trimmed = await get("search=Pun")
    const padded = await get("search=%20Pun%20")
    expect(padded.status).toBe(200)
    expect(padded.body).toEqual(trimmed.body)
  })

  it.each([
    ["empty", "search="],
    ["whitespace only", "search=%20%20"],
    ["repeated key", "search=a&search=b"],
    ["over 100 characters", `search=${"x".repeat(101)}`],
  ])("returns 400 for %s", async (_label, query) => {
    const res = await get(query)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
  })

  it("finds a newly created sample and stops finding it once deleted", async () => {
    const created = await request(app).post("/api/v1/samples").send(validPayload)
    expect(ids((await get("search=SMP-900")).body)).toEqual([created.body.data.id])

    await request(app).delete(`/api/v1/samples/${created.body.data.id}`)
    expect((await get("search=SMP-900")).body.data).toEqual([])
  })
})

describe("GET /api/v1/samples sorting", () => {
  const seed = buildSeedSamples()
  const ids = (body: { data: { id: number }[] }) => body.data.map((s) => s.id)
  const get = (query: string) => request(app).get(`/api/v1/samples?limit=50&${query}`)

  // Independent reference: ascending by key, ties by id ascending, optionally reversed.
  const expectedIds = (
    key: (s: Sample) => number,
    direction: 1 | -1,
    source: Sample[] = seed,
  ): number[] =>
    [...source].sort((a, b) => (key(a) - key(b)) * direction || a.id - b.id).map((s) => s.id)

  it("sorts by volumeMl ascending and descending", async () => {
    const asc = await get("sortBy=volumeMl")
    expect(asc.status).toBe(200)
    expect(ids(asc.body)).toEqual(expectedIds((s) => s.volumeMl, 1).slice(0, 50))

    const desc = await get("sortBy=volumeMl&order=desc")
    expect(ids(desc.body)).toEqual(expectedIds((s) => s.volumeMl, -1).slice(0, 50))
  })

  it("sorts by collectedAt with the newest first for order=desc", async () => {
    const res = await get("sortBy=collectedAt&order=desc")
    const dates: string[] = res.body.data.map((s: { collectedAt: string }) => s.collectedAt)
    expect(dates).toEqual([...dates].sort().reverse())
    expect(ids(res.body)).toEqual(expectedIds((s) => Date.parse(s.collectedAt), -1).slice(0, 50))
  })

  it("sorts status in lifecycle order and sampleCode descending", async () => {
    const byStatus = await get("sortBy=status")
    const distinct = byStatus.body.data
      .map((s: { status: string }) => s.status)
      .filter((s: string, i: number, arr: string[]) => arr.indexOf(s) === i)
    expect(distinct).toEqual([...SAMPLE_STATUSES])

    const byCode = await get("sortBy=sampleCode&order=desc")
    expect(ids(byCode.body)).toEqual(expectedIds((s) => s.id, -1).slice(0, 50))
  })

  it("pages through a sorted set without gaps or overlaps", async () => {
    const base = "/api/v1/samples?sortBy=volumeMl&order=desc&limit=30"
    const one = await request(app).get(`${base}&page=1`)
    const two = await request(app).get(`${base}&page=2`)
    expect([...ids(one.body), ...ids(two.body)]).toEqual(expectedIds((s) => s.volumeMl, -1))
  })

  it("sorts within filters and search", async () => {
    const filtered = seed.filter((s) => s.site === "Pune")
    const res = await get("site=Pune&sortBy=volumeMl&order=desc")
    expect(ids(res.body)).toEqual(expectedIds((s) => s.volumeMl, -1, filtered))
    expect(res.body.meta.total).toBe(filtered.length)

    const searched = seed.filter((s) => s.sampleCode.includes("SMP-00"))
    const res2 = await get("search=SMP-00&sortBy=volumeMl")
    expect(ids(res2.body)).toEqual(expectedIds((s) => s.volumeMl, 1, searched))
  })

  it("ignores order when sortBy is absent", async () => {
    const plain = await get("")
    const orderOnly = await get("order=desc")
    expect(orderOnly.status).toBe(200)
    expect(orderOnly.body).toEqual(plain.body)
  })

  it.each([
    ["unknown field", "sortBy=site"],
    ["wrong-case field", "sortBy=VOLUMEML"],
    ["empty sortBy", "sortBy="],
    ["unknown order", "sortBy=volumeMl&order=up"],
    ["empty order", "order="],
    ["repeated sortBy", "sortBy=volumeMl&sortBy=status"],
  ])("returns 400 for %s", async (_label, query) => {
    const res = await get(query)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
  })

  it("places a newly created sample in its sorted position", async () => {
    const created = await request(app)
      .post("/api/v1/samples")
      .send({ ...validPayload, volumeMl: 99 })
    const desc = await get("sortBy=volumeMl&order=desc")
    expect(ids(desc.body)[0]).toBe(created.body.data.id)
  })
})

describe("GET /api/v1/samples/:id", () => {
  it("returns a single sample", async () => {
    const res = await request(app).get("/api/v1/samples/1")
    expect(res.status).toBe(200)
    expect(res.body.data.sampleCode).toBe("SMP-001")
  })

  it("returns 404 for an unknown id", async () => {
    const res = await request(app).get("/api/v1/samples/9999")
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe("NOT_FOUND")
  })

  it("returns 400 for a non-numeric id", async () => {
    const res = await request(app).get("/api/v1/samples/abc")
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
  })
})

describe("POST /api/v1/samples", () => {
  it("creates a sample with defaults applied", async () => {
    const res = await request(app).post("/api/v1/samples").send(validPayload)
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({ sampleCode: "SMP-900", status: "collected" })
    expect(typeof res.body.data.id).toBe("number")
  })

  it("rejects an invalid body", async () => {
    const res = await request(app).post("/api/v1/samples").send({ sampleCode: "nope" })
    expect(res.status).toBe(400)
    expect(res.body.error.details.length).toBeGreaterThan(0)
  })

  it("rejects a duplicate sampleCode", async () => {
    const res = await request(app)
      .post("/api/v1/samples")
      .send({ ...validPayload, sampleCode: "SMP-001" })
    expect(res.status).toBe(409)
  })

  it("returns 400 for malformed JSON", async () => {
    const res = await request(app)
      .post("/api/v1/samples")
      .set("Content-Type", "application/json")
      .send("{ not json")
    expect(res.status).toBe(400)
  })
})

describe("PATCH /api/v1/samples/:id/status", () => {
  it("updates the status", async () => {
    const res = await request(app).patch("/api/v1/samples/1/status").send({ status: "completed" })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe("completed")
  })

  it("rejects an unknown status", async () => {
    const res = await request(app).patch("/api/v1/samples/1/status").send({ status: "lost" })
    expect(res.status).toBe(400)
  })
})

describe("DELETE /api/v1/samples/:id", () => {
  it("deletes a sample and then 404s", async () => {
    expect((await request(app).delete("/api/v1/samples/1")).status).toBe(204)
    expect((await request(app).get("/api/v1/samples/1")).status).toBe(404)
  })
})

describe("misc", () => {
  it("serves /health", async () => {
    const res = await request(app).get("/health")
    expect(res.status).toBe(200)
    expect(res.body.status).toBe("ok")
  })

  it("returns a JSON 404 for unknown routes", async () => {
    const res = await request(app).get("/nope")
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })
})
