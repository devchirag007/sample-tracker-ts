import type { NextFunction, Request, RequestHandler, Response } from "express"

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>

// Express 4 does not forward rejected promises from async handlers, so we do it here.
export const asyncHandler =
  (handler: AsyncHandler): RequestHandler =>
  (req, res, next) => {
    handler(req, res, next).catch(next)
  }
