import { createApp } from "./app"
import { env } from "./config/env"
import { logger } from "./config/logger"

const app = createApp()

const server = app.listen(env.PORT, () => {
  logger.info(`Server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`)
})

const shutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down`)
  server.close((err) => {
    if (err) {
      logger.error({ err }, "Error during shutdown")
      process.exit(1)
    }
    process.exit(0)
  })
  // Force-exit if connections refuse to drain.
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))
