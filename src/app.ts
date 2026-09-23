import cors from "cors"
import express from "express"
import helmet from "helmet"
import pinoHttp from "pino-http"
import { logger } from "./config/logger"
import { errorHandler } from "./middlewares/error-handler"
import { notFound } from "./middlewares/not-found"
import { createSampleController } from "./modules/samples/sample.controller"
import {
  createInMemorySampleRepository,
  type SampleRepository,
} from "./modules/samples/sample.repository"
import { createSampleRouter } from "./modules/samples/sample.routes"
import { createSampleService } from "./modules/samples/sample.service"

export interface AppDependencies {
  sampleRepository?: SampleRepository
}

// Factory (instead of a module-level singleton) so tests can inject an isolated repository.
export const createApp = ({
  sampleRepository = createInMemorySampleRepository(),
}: AppDependencies = {}) => {
  const app = express()

  app.disable("x-powered-by")
  app.use(helmet())
  app.use(cors())
  app.use(pinoHttp({ logger }))
  app.use(express.json({ limit: "100kb" }))

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", uptime: process.uptime() })
  })

  const sampleService = createSampleService(sampleRepository)
  const sampleController = createSampleController(sampleService)
  app.use("/api/v1/samples", createSampleRouter(sampleController))

  app.use(notFound)
  app.use(errorHandler)

  return app
}
