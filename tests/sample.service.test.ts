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
})
