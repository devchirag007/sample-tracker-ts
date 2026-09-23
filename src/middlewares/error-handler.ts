import type { ErrorRequestHandler } from "express"
import { ZodError } from "zod"
import { AppError } from "../errors/app-error"

interface HttpLikeError {
  status?: number
  statusCode?: number
  message: string
}

const errorBody = (code: string, message: string, details?: unknown) => ({
  success: false,
  error: { code, message, ...(details !== undefined && { details }) },
})

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }))
    res.status(400).json(errorBody("VALIDATION_ERROR", "Request validation failed", details))
    return
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json(errorBody(err.code, err.message, err.details))
    return
  }

  // Errors raised by Express itself (e.g. malformed JSON body) carry a 4xx status.
  const status = (err as HttpLikeError).status ?? (err as HttpLikeError).statusCode
  if (status && status >= 400 && status < 500) {
    res.status(status).json(errorBody("BAD_REQUEST", (err as HttpLikeError).message))
    return
  }

  req.log.error({ err }, "Unhandled error")
  res.status(500).json(errorBody("INTERNAL_ERROR", "Something went wrong"))
}
