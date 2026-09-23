export const SAMPLE_TYPES = ["blood", "urine", "saliva", "plasma", "serum", "tissue"] as const
export const SAMPLE_STATUSES = [
  "collected",
  "received",
  "in_testing",
  "completed",
  "rejected",
] as const

export const SAMPLE_SORT_FIELDS = ["collectedAt", "sampleCode", "volumeMl", "status"] as const
export const SORT_ORDERS = ["asc", "desc"] as const

export type SampleType = (typeof SAMPLE_TYPES)[number]
export type SampleSortField = (typeof SAMPLE_SORT_FIELDS)[number]
export type SortOrder = (typeof SORT_ORDERS)[number]
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

export interface PageRequest {
  page: number
  limit: number
}

// Each field is a set of allowed values (OR within a field, AND across fields); omitted = no filter.
export interface SampleFilters {
  status?: SampleStatus[]
  site?: string[]
  studyId?: string[]
}

// Case-sensitive substring matched against sampleCode or site.
export interface SampleSearch {
  search?: string
}

// No sortBy = repository order. order defaults to "asc" in the service and is ignored without sortBy.
export interface SampleSort {
  sortBy?: SampleSortField
  order?: SortOrder
}

export type ListSamplesQuery = PageRequest & SampleFilters & SampleSearch & SampleSort

export interface PageMeta extends PageRequest {
  total: number
  totalPages: number
}

export interface Paginated<T> {
  data: T[]
  meta: PageMeta
}
