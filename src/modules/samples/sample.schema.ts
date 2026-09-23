import { z } from "zod"
import { SAMPLE_STATUSES, SAMPLE_TYPES } from "./sample.types"

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const MAX_PAGE_SIZE = 50

// Query-string values arrive as strings, hence coerce. Defaults apply only when the key is absent.
export const listSamplesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(10),
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
