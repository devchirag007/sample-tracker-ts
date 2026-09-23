import { z } from "zod"
import { SAMPLE_SORT_FIELDS, SAMPLE_STATUSES, SAMPLE_TYPES, SORT_ORDERS } from "./sample.types"

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const MAX_PAGE_SIZE = 50
export const MAX_SEARCH_LENGTH = 100

// Accepts "a,b" and repeated keys (?k=a&k=b, which Express parses to an array); yields string[].
// Whitespace is trimmed and empty tokens are kept, so "a," or "" fail the item schema (400).
const csvList = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((value) => {
    const parts = Array.isArray(value) ? value : [value]
    if (!parts.every((p) => typeof p === "string")) return value
    return parts.flatMap((p: string) => p.split(",").map((s) => s.trim()))
  }, z.array(item).optional())

// Query-string values arrive as strings, hence coerce. Defaults apply only when the key is absent.
export const listSamplesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(10),
  status: csvList(z.enum(SAMPLE_STATUSES)),
  site: csvList(z.string().min(1)),
  studyId: csvList(z.string().min(1)),
  // Surrounding whitespace is trimmed; the match itself stays case-sensitive. Repeated keys -> 400.
  search: z.string().trim().min(1).max(MAX_SEARCH_LENGTH).optional(),
  // Enum values are case-sensitive; anything else (or a repeated key) -> 400.
  sortBy: z.enum(SAMPLE_SORT_FIELDS).optional(),
  order: z.enum(SORT_ORDERS).optional(),
})

export const createSampleSchema = z.object({
  sampleCode: z.string().regex(/^SMP-\d+$/, "sampleCode must look like SMP-123"),
  studyId: z.string().min(1),
  type: z.enum(SAMPLE_TYPES),
  status: z.enum(SAMPLE_STATUSES).default("collected"),
  site: z.string().min(1),
  volumeMl: z.number().positive(),
  collectedAt: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
})

export const updateStatusSchema = z.object({
  status: z.enum(SAMPLE_STATUSES),
})
