import session from "express-session"
import { AUTH_ENABLED, RUN_MODE, SESSION_SECRET } from "../env.js"

declare module "express-session" {
  interface SessionData {
    userId?: string
    email?: string
    name?: string
    ssoState?: string
    ssoCodeVerifier?: string
  }
}

export function createSessionMiddleware() {
  if (RUN_MODE !== "standalone" || !AUTH_ENABLED) {
    return (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) =>
      next()
  }
  return session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: "quantis.sid",
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
}
