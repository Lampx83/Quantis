import { Request, Response, NextFunction } from "express"
import { AUTH_REQUIRED, RUN_MODE } from "../env.js"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Standalone + AUTH_REQUIRED: cần session.
 * AI Portal: middleware gửi X-User-Id — cho qua dù RUN_MODE chưa kịp = embedded trong bundle.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const headerId = (req.headers["x-user-id"] as string)?.trim()
  if (headerId && UUID.test(headerId)) {
    next()
    return
  }
  if (RUN_MODE !== "standalone" || !AUTH_REQUIRED) {
    next()
    return
  }
  const sess = req.session as { userId?: string } | undefined
  if (sess?.userId) {
    next()
    return
  }
  res.status(401).json({ error: "Unauthorized", code: "LOGIN_REQUIRED" })
}
