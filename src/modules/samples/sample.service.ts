import { ConflictError, NotFoundError } from "../../errors/app-error"
import type { SampleRepository } from "./sample.repository"
import { SAMPLE_STATUSES } from "./sample.types"
import type {
  CreateSampleInput,
  ListSamplesQuery,
  Paginated,
  Sample,
  SampleSortField,
  SampleStatus,
} from "./sample.types"

// Ascending comparators. sampleCode uses numeric collation so SMP-999 sorts before SMP-1000;
// status follows the lifecycle order (collected -> ... -> rejected), not the alphabet.
const comparators: Record<SampleSortField, (a: Sample, b: Sample) => number> = {
  collectedAt: (a, b) => Date.parse(a.collectedAt) - Date.parse(b.collectedAt),
  sampleCode: (a, b) => a.sampleCode.localeCompare(b.sampleCode, "en", { numeric: true }),
  volumeMl: (a, b) => a.volumeMl - b.volumeMl,
  status: (a, b) => SAMPLE_STATUSES.indexOf(a.status) - SAMPLE_STATUSES.indexOf(b.status),
}

const toSet = <T>(values?: T[]) => (values ? new Set(values) : undefined)

export const createSampleService = (repository: SampleRepository) => ({
  async list(): Promise<Sample[]> {
    return repository.findAll()
  },

  async listPage({
    page,
    limit,
    status,
    site,
    studyId,
    search,
    sortBy,
    order = "asc",
  }: ListSamplesQuery): Promise<Paginated<Sample>> {
    const statuses = toSet(status)
    const sites = toSet(site)
    const studyIds = toSet(studyId)

    // filter() and slice() return new arrays, so the repository's data is never touched.
    const matching = (await repository.findAll()).filter(
      (s) =>
        (!statuses || statuses.has(s.status)) &&
        (!sites || sites.has(s.site)) &&
        (!studyIds || studyIds.has(s.studyId)) &&
        (!search || s.sampleCode.includes(search) || s.site.includes(search)),
    )

    if (sortBy) {
      // Safe to sort in place: filter() above returned a new array. Ties fall back to id (always
      // ascending) so paging stays deterministic.
      const compare = comparators[sortBy]
      const direction = order === "desc" ? -1 : 1
      matching.sort((a, b) => compare(a, b) * direction || a.id - b.id)
    }

    const start = (page - 1) * limit
    return {
      data: matching.slice(start, start + limit),
      meta: { page, limit, total: matching.length, totalPages: Math.ceil(matching.length / limit) },
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
