export const SAMPLE_TYPES = ["blood", "urine", "saliva", "plasma", "serum", "tissue"] as const
export const SAMPLE_STATUSES = [
  "collected",
  "received",
  "in_testing",
  "completed",
  "rejected",
] as const

export type SampleType = (typeof SAMPLE_TYPES)[number]
export type SampleStatus = (typeof SAMPLE_STATUSES)[number]

export interface Sample {
  id: number
  sampleCode: string
  studyId: string
  type: SampleType
  status: SampleStatus
  site: string
  volumeMl: number
  collectedAt: string // ISO 8601
}

export type CreateSampleInput = Omit<Sample, "id">
