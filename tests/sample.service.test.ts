import { NotFoundError } from "../src/errors/app-error"
import { createInMemorySampleRepository } from "../src/modules/samples/sample.repository"
import { buildSeedSamples } from "../src/modules/samples/sample.seed"
import { createSampleService } from "../src/modules/samples/sample.service"
import { SAMPLE_STATUSES } from "../src/modules/samples/sample.types"
import type { Sample, SampleSortField } from "../src/modules/samples/sample.types"

describe("sample service", () => {
  const setup = () => createSampleService(createInMemorySampleRepository())

  it("list returns every seeded sample", async () => {
    expect(await setup().list()).toHaveLength(60)
  })

  it("getById throws NotFoundError for a missing sample", async () => {
    await expect(setup().getById(12345)).rejects.toBeInstanceOf(NotFoundError)
  })

  it("list does not expose the repository's internal array", async () => {
    const repo = createInMemorySampleRepository()
    const service = createSampleService(repo)
    const first = await service.list()
    first.length = 0
    expect(await service.list()).toHaveLength(60)
  })

  describe("listPage", () => {
    it("slices the requested page and computes totalPages with ceil", async () => {
      const { data, meta } = await setup().listPage({ page: 3, limit: 25 })
      expect(data).toHaveLength(10)
      expect(data[0]!.id).toBe(51)
      expect(meta).toEqual({ page: 3, limit: 25, total: 60, totalPages: 3 })
    })

    it("does not mutate or expose the repository's data", async () => {
      const service = setup()
      const first = await service.listPage({ page: 1, limit: 10 })
      first.data.length = 0
      first.data.push({} as never)

      const again = await service.listPage({ page: 1, limit: 10 })
      expect(again.data).toHaveLength(10)
      expect(again.data[0]!.id).toBe(1)
      expect(await service.list()).toHaveLength(60)
    })

    it("returns empty data and zero totals for an empty repository", async () => {
      const service = createSampleService(createInMemorySampleRepository([]))
      const { data, meta } = await service.listPage({ page: 1, limit: 10 })
      expect(data).toEqual([])
      expect(meta).toEqual({ page: 1, limit: 10, total: 0, totalPages: 0 })
    })

    describe("filters", () => {
      const seed = buildSeedSamples()
      const all = { page: 1, limit: 50 }

      it("filters by a single status and counts only the filtered set", async () => {
        const expected = seed.filter((s) => s.status === "collected")
        const { data, meta } = await setup().listPage({ ...all, status: ["collected"] })
        expect(data.map((s) => s.id)).toEqual(expected.map((s) => s.id))
        expect(meta.total).toBe(expected.length)
      })

      it("ORs multiple values within one field", async () => {
        const expected = seed.filter((s) => ["collected", "received"].includes(s.status))
        const { meta } = await setup().listPage({ ...all, status: ["collected", "received"] })
        expect(meta.total).toBe(expected.length)
      })

      it("ANDs filters across fields", async () => {
        const expected = seed.filter(
          (s) => ["Pune", "Delhi"].includes(s.site) && s.studyId === "study-001",
        )
        expect(expected.length).toBeGreaterThan(0)
        const { data } = await setup().listPage({
          ...all,
          site: ["Pune", "Delhi"],
          studyId: ["study-001"],
        })
        expect(data.map((s) => s.id)).toEqual(expected.map((s) => s.id))
      })

      it("paginates the filtered list, not the full list", async () => {
        const expected = seed.filter((s) => s.site === "Pune")
        const { data, meta } = await setup().listPage({ page: 2, limit: 5, site: ["Pune"] })
        expect(data.map((s) => s.id)).toEqual(expected.slice(5, 10).map((s) => s.id))
        expect(meta).toEqual({
          page: 2,
          limit: 5,
          total: expected.length,
          totalPages: Math.ceil(expected.length / 5),
        })
      })

      it("returns empty data and zero totals when nothing matches", async () => {
        const { data, meta } = await setup().listPage({ page: 1, limit: 10, site: ["Nowhere"] })
        expect(data).toEqual([])
        expect(meta).toEqual({ page: 1, limit: 10, total: 0, totalPages: 0 })
      })

      it("does not duplicate results for duplicate filter values", async () => {
        const once = await setup().listPage({ ...all, site: ["Pune"] })
        const twice = await setup().listPage({ ...all, site: ["Pune", "Pune"] })
        expect(twice.data).toEqual(once.data)
      })

      it("leaves the repository's contents and order unchanged", async () => {
        const service = setup()
        const before = (await service.list()).map((s) => s.id)
        await service.listPage({ page: 1, limit: 5, status: ["received"], site: ["Pune"] })
        expect((await service.list()).map((s) => s.id)).toEqual(before)
      })
    })

    describe("search", () => {
      const seed = buildSeedSamples()
      const all = { page: 1, limit: 50 }
      const idsFor = async (query: object) =>
        (await setup().listPage({ ...all, ...query })).data.map((s) => s.id)

      it("matches a substring of sampleCode", async () => {
        expect(await idsFor({ search: "SMP-00" })).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
      })

      it("matches a substring of site", async () => {
        const expected = seed.filter((s) => s.site.includes("Pun"))
        expect(expected.length).toBeGreaterThan(0)
        expect(await idsFor({ search: "Pun" })).toEqual(expected.map((s) => s.id))
      })

      it("matches on either field and returns each sample once", async () => {
        // "e" appears in many site names and in no sampleCode; "S" only in sampleCode.
        const expectedE = seed.filter((s) => s.sampleCode.includes("e") || s.site.includes("e"))
        const foundE = await idsFor({ search: "e" })
        expect(foundE).toEqual(expectedE.map((s) => s.id))
        expect(new Set(foundE).size).toBe(foundE.length)
        const { meta } = await setup().listPage({ ...all, search: "S" })
        expect(meta.total).toBe(seed.length)
      })

      it("is case-sensitive", async () => {
        expect(await idsFor({ search: "pune" })).toEqual([])
        expect(await idsFor({ search: "smp" })).toEqual([])
      })

      it.each([".*", "%", "(", "["])("treats %j literally without throwing", async (search) => {
        expect(await idsFor({ search })).toEqual([])
      })

      it("ANDs with the other filters", async () => {
        const expected = seed.filter(
          (s) => s.sampleCode.includes("SMP-00") && s.site === "Pune" && s.status === "received",
        )
        expect(expected.length).toBeGreaterThan(0)
        const ids = await idsFor({ search: "SMP-00", site: ["Pune"], status: ["received"] })
        expect(ids).toEqual(expected.map((s) => s.id))
        expect(ids.length).toBeLessThan(9)
      })

      it("paginates the searched set", async () => {
        const expected = seed.filter((s) => s.site.includes("Pun"))
        const { data, meta } = await setup().listPage({ page: 2, limit: 5, search: "Pun" })
        expect(data.map((s) => s.id)).toEqual(expected.slice(5, 10).map((s) => s.id))
        expect(meta).toEqual({
          page: 2,
          limit: 5,
          total: expected.length,
          totalPages: Math.ceil(expected.length / 5),
        })
      })

      it("returns empty data and zero totals when nothing matches", async () => {
        const { data, meta } = await setup().listPage({ page: 1, limit: 10, search: "zzz" })
        expect(data).toEqual([])
        expect(meta).toEqual({ page: 1, limit: 10, total: 0, totalPages: 0 })
      })

      it("leaves the repository's contents and order unchanged", async () => {
        const service = setup()
        const before = (await service.list()).map((s) => s.id)
        await service.listPage({ page: 1, limit: 5, search: "SMP" })
        expect((await service.list()).map((s) => s.id)).toEqual(before)
      })
    })

    describe("sorting", () => {
      const seed = buildSeedSamples()
      const all = { page: 1, limit: 50 }
      const idsFor = async (query: object, service = setup()) =>
        (await service.listPage({ ...all, ...query })).data.map((s) => s.id)

      // Independent reference: ascending by key, ties by id ascending, optionally reversed.
      const keys: Record<SampleSortField, (s: Sample) => number> = {
        collectedAt: (s) => Date.parse(s.collectedAt),
        sampleCode: (s) => s.id, // seed codes are zero-padded, so code order == id order
        volumeMl: (s) => s.volumeMl,
        status: (s) => SAMPLE_STATUSES.indexOf(s.status),
      }
      const expectedIds = (
        field: SampleSortField,
        direction: 1 | -1,
        source: Sample[] = seed,
      ): number[] =>
        [...source]
          .sort((a, b) => (keys[field](a) - keys[field](b)) * direction || a.id - b.id)
          .map((s) => s.id)

      const fields: SampleSortField[] = ["collectedAt", "sampleCode", "volumeMl", "status"]
      const cases = fields.flatMap((f) => [
        [f, "asc", 1],
        [f, "desc", -1],
      ]) as [SampleSortField, "asc" | "desc", 1 | -1][]

      it.each(cases)("sorts by %s %s", async (sortBy, order, direction) => {
        expect(await idsFor({ sortBy, order })).toEqual(
          expectedIds(sortBy, direction).slice(0, all.limit),
        )
      })

      it("sorts status in lifecycle order, not alphabetically", async () => {
        const { data } = await setup().listPage({ ...all, sortBy: "status" })
        const distinct = data.map((s) => s.status).filter((s, i, arr) => arr.indexOf(s) === i)
        expect(distinct).toEqual([...SAMPLE_STATUSES])
      })

      it("sorts sampleCode with numeric-aware ordering", async () => {
        const base = seed[0]!
        const codes = ["SMP-1000", "SMP-999", "SMP-9", "SMP-100"]
        const repo = createInMemorySampleRepository(
          codes.map((sampleCode, i) => ({ ...base, id: i + 1, sampleCode })),
        )
        const { data } = await createSampleService(repo).listPage({
          page: 1,
          limit: 10,
          sortBy: "sampleCode",
        })
        expect(data.map((s) => s.sampleCode)).toEqual(["SMP-9", "SMP-100", "SMP-999", "SMP-1000"])
      })

      it("sorts collectedAt by date, not by string", async () => {
        const base = seed[0]!
        const stamps = ["2026-01-01T00:00:00Z", "2026-01-01T00:00:00.500Z", "2025-12-31T23:59:59Z"]
        const repo = createInMemorySampleRepository(
          stamps.map((collectedAt, i) => ({ ...base, id: i + 1, collectedAt })),
        )
        const service = createSampleService(repo)
        const { data } = await service.listPage({ page: 1, limit: 10, sortBy: "collectedAt" })
        // A plain string sort would put id 2 ("…00.500Z") before id 1 ("…00Z").
        expect(data.map((s) => s.id)).toEqual([3, 1, 2])
      })

      it.each(["asc", "desc"] as const)("breaks ties by ascending id (order=%s)", async (order) => {
        const { data } = await setup().listPage({ ...all, sortBy: "status", order })
        for (let i = 1; i < data.length; i++) {
          if (data[i - 1]!.status === data[i]!.status) {
            expect(data[i - 1]!.id).toBeLessThan(data[i]!.id)
          }
        }
      })

      it.each(["asc", "desc"] as const)(
        "breaks ties by id even when the repository is not in id order (order=%s)",
        async (order) => {
          const base = seed[0]!
          const repo = createInMemorySampleRepository(
            [3, 1, 2].map((id) => ({ ...base, id, sampleCode: `SMP-${id}`, volumeMl: 5 })),
          )
          const { data } = await createSampleService(repo).listPage({
            page: 1,
            limit: 10,
            sortBy: "volumeMl",
            order,
          })
          expect(data.map((s) => s.id)).toEqual([1, 2, 3])
        },
      )

      it("defaults order to ascending", async () => {
        expect(await idsFor({ sortBy: "volumeMl" })).toEqual(
          await idsFor({ sortBy: "volumeMl", order: "asc" }),
        )
      })

      it("leaves repository order untouched when order is given without sortBy", async () => {
        expect(await idsFor({ order: "desc" })).toEqual(seed.slice(0, 50).map((s) => s.id))
      })

      it("sorts before paginating", async () => {
        const expected = expectedIds("volumeMl", -1)
        const service = setup()
        const page = await service.listPage({
          page: 2,
          limit: 5,
          sortBy: "volumeMl",
          order: "desc",
        })
        expect(page.data.map((s) => s.id)).toEqual(expected.slice(5, 10))

        const one = await service.listPage({
          page: 1,
          limit: 30,
          sortBy: "volumeMl",
          order: "desc",
        })
        const two = await service.listPage({
          page: 2,
          limit: 30,
          sortBy: "volumeMl",
          order: "desc",
        })
        expect([...one.data, ...two.data].map((s) => s.id)).toEqual(expected)
      })

      it("sorts only the filtered and searched set without changing meta.total", async () => {
        const filtered = seed.filter((s) => s.site === "Pune" && s.sampleCode.includes("SMP-0"))
        expect(filtered.length).toBeGreaterThan(1)
        const { data, meta } = await setup().listPage({
          ...all,
          site: ["Pune"],
          search: "SMP-0",
          sortBy: "volumeMl",
          order: "desc",
        })
        expect(data.map((s) => s.id)).toEqual(expectedIds("volumeMl", -1, filtered))
        expect(meta.total).toBe(filtered.length)
      })

      it("leaves the repository's contents and order unchanged", async () => {
        const service = setup()
        const before = (await service.list()).map((s) => s.id)
        await service.listPage({ ...all, sortBy: "volumeMl", order: "desc" })
        expect((await service.list()).map((s) => s.id)).toEqual(before)
      })
    })
  })
})
