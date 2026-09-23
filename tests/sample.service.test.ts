import { NotFoundError } from "../src/errors/app-error"
import { createInMemorySampleRepository } from "../src/modules/samples/sample.repository"
import { createSampleService } from "../src/modules/samples/sample.service"

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
  })
})
