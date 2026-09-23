import { ConflictError, NotFoundError } from "../../errors/app-error"
import type { SampleRepository } from "./sample.repository"
import type {
  CreateSampleInput,
  PageRequest,
  Paginated,
  Sample,
  SampleStatus,
} from "./sample.types"

export const createSampleService = (repository: SampleRepository) => ({
  async list(): Promise<Sample[]> {
    return repository.findAll()
  },

  async listPage({ page, limit }: PageRequest): Promise<Paginated<Sample>> {
    const all = await repository.findAll()
    const start = (page - 1) * limit
    return {
      // slice() returns a new array, so the repository's data is never touched.
      data: all.slice(start, start + limit),
      meta: { page, limit, total: all.length, totalPages: Math.ceil(all.length / limit) },
    }
  },

  async getById(id: number): Promise<Sample> {
    const sample = await repository.findById(id)
    if (!sample) throw new NotFoundError(`Sample ${id} not found`)
    return sample
  },

  async create(input: CreateSampleInput): Promise<Sample> {
    const existing = await repository.findBySampleCode(input.sampleCode)
    if (existing) throw new ConflictError(`Sample ${input.sampleCode} already exists`)
    return repository.insert(input)
  },

  async updateStatus(id: number, status: SampleStatus): Promise<Sample> {
    const sample = await repository.updateStatus(id, status)
    if (!sample) throw new NotFoundError(`Sample ${id} not found`)
    return sample
  },

  async remove(id: number): Promise<void> {
    const removed = await repository.remove(id)
    if (!removed) throw new NotFoundError(`Sample ${id} not found`)
  },
})

export type SampleService = ReturnType<typeof createSampleService>
