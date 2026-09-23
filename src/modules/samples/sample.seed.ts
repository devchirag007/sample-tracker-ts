import type { Sample } from "./sample.types"
import { SAMPLE_STATUSES, SAMPLE_TYPES } from "./sample.types"

const SITES = ["Mumbai", "Pune", "Bangalore", "Chennai", "Delhi"]
const STUDIES = ["study-001", "study-002", "study-003", "study-004"]

// Deterministic seed data (60 records) so results are reproducible between runs.
export const buildSeedSamples = (): Sample[] =>
  Array.from({ length: 60 }, (_, i) => {
    const n = i + 1
    const collected = new Date(Date.UTC(2026, 0, 1 + ((n * 7) % 240)))
    return {
      id: n,
      sampleCode: `SMP-${String(n).padStart(3, "0")}`,
      studyId: STUDIES[(n * 3) % STUDIES.length]!,
      type: SAMPLE_TYPES[(n * 5) % SAMPLE_TYPES.length]!,
      status: SAMPLE_STATUSES[(n * 2) % SAMPLE_STATUSES.length]!,
      site: SITES[(n * 7) % SITES.length]!,
      volumeMl: Number((((n * 1.37) % 10) + 0.5).toFixed(1)),
      collectedAt: collected.toISOString(),
    }
  })
