import { buildSeedSamples } from "./sample.seed"
import type { CreateSampleInput, Sample, SampleStatus } from "./sample.types"

/**
 * Persistence boundary. The service only knows this interface, so the in-memory
 * implementation below can be replaced by a real database without touching business logic.
 */
export interface SampleRepository {
  findAll(): Promise<Sample[]>
  findById(id: number): Promise<Sample | undefined>
  findBySampleCode(sampleCode: string): Promise<Sample | undefined>
  insert(input: CreateSampleInput): Promise<Sample>
  updateStatus(id: number, status: SampleStatus): Promise<Sample | undefined>
  remove(id: number): Promise<boolean>
}

export const createInMemorySampleRepository = (
  initial: Sample[] = buildSeedSamples(),
): SampleRepository => {
  const samples = [...initial]
  let nextId = samples.reduce((max, s) => Math.max(max, s.id), 0) + 1

  return {
    async findAll() {
      return [...samples]
    },

    async findById(id) {
      return samples.find((s) => s.id === id)
    },

    async findBySampleCode(sampleCode) {
      return samples.find((s) => s.sampleCode === sampleCode)
    },

    async insert(input) {
      const sample: Sample = { id: nextId++, ...input }
      samples.push(sample)
      return sample
    },

    async updateStatus(id, status) {
      const sample = samples.find((s) => s.id === id)
      if (!sample) return undefined
      sample.status = status
      return sample
    },

    async remove(id) {
      const index = samples.findIndex((s) => s.id === id)
      if (index === -1) return false
      samples.splice(index, 1)
      return true
    },
  }
}
