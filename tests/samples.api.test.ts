import request from "supertest"
import { createApp } from "../src/app"
import { createInMemorySampleRepository } from "../src/modules/samples/sample.repository"

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
