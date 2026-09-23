import { Router } from "express"
import type { SampleController } from "./sample.controller"

export const createSampleRouter = (controller: SampleController) => {
  const router = Router()

  router.get("/", controller.list)
  router.get("/:id", controller.getById)
  router.post("/", controller.create)
  router.patch("/:id/status", controller.updateStatus)
  router.delete("/:id", controller.remove)

  return router
}
