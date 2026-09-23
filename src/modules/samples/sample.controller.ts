import { asyncHandler } from "../../utils/async-handler"
import {
  createSampleSchema,
  idParamSchema,
  listSamplesQuerySchema,
  updateStatusSchema,
} from "./sample.schema"
import type { SampleService } from "./sample.service"

// asyncHandler forwards rejected promises to the error middleware (Express 4 needs this).
export const createSampleController = (service: SampleService) => {
  const list = asyncHandler(async (req, res) => {
    const query = listSamplesQuerySchema.parse(req.query)
    const { data, meta } = await service.listPage(query)
    res.status(200).json({ success: true, data, meta })
  })

  const getById = asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params)
    const sample = await service.getById(id)
    res.status(200).json({ success: true, data: sample })
  })

  const create = asyncHandler(async (req, res) => {
    const input = createSampleSchema.parse(req.body)
    const sample = await service.create(input)
    res.status(201).json({ success: true, data: sample })
  })

  const updateStatus = asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params)
    const { status } = updateStatusSchema.parse(req.body)
    const sample = await service.updateStatus(id, status)
    res.status(200).json({ success: true, data: sample })
  })

  const remove = asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params)
    await service.remove(id)
    res.status(204).send()
  })

  return { list, getById, create, updateStatus, remove }
}

export type SampleController = ReturnType<typeof createSampleController>
