/**
 * Auth — SurveyLab-compatible; đường dẫn mount: /api/quantis/auth/*
 */
import { Request, Response } from "express"
import bcrypt from "bcrypt"
import { query, withSchema } from "../db.js"
import {
  RUN_MODE,
  AUTH_ENABLED,
  AUTH_REQUIRED,
  ADMIN_EMAILS,
  SSO_ISSUER_URL,
  SSO_CLIENT_ID,
  SSO_CLIENT_SECRET,
  SSO_CALLBACK_URL,
  SSO_LABEL,
} from "../env.js"
import { getAuthorizationUrl, handleCallback as handleOidcCallback } from "../lib/oidc.js"

const SALT_ROUNDS = 10

function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.size > 0 && ADMIN_EMAILS.has(email.trim().toLowerCase())
}

export function authEnabled(): boolean {
  return RUN_MODE === "standalone" && AUTH_ENABLED
}

export async function getConfig(_req: Request, res: Response): Promise<void> {
  if (!authEnabled()) {
    res.json({ authEnabled: false, ssoEnabled: false, ssoLabel: "", authRequired: false })
    return
  }
  const ssoEnabled = Boolean(SSO_ISSUER_URL && SSO_CLIENT_ID && SSO_CLIENT_SECRET && SSO_CALLBACK_URL)
  res.json({
    authEnabled: true,
    ssoEnabled,
    ssoLabel: SSO_LABEL || "Đăng nhập bằng SSO",
    authRequired: AUTH_REQUIRED,
  })
}

export async function getMe(req: Request, res: Response): Promise<void> {
  if (!authEnabled()) {
    res.status(401).json({ error: "Auth not enabled" })
    return
  }
  const userId = (req.session as { userId?: string })?.userId
  if (!userId) {
    res.status(401).json({ error: "Not logged in" })
    return
  }
  const result = await query<{ id: string; email: string; name: string | null }>(
    withSchema(`SELECT id, email, name FROM __SCHEMA__.users WHERE id = $1::uuid`),
    [userId]
  )
  const row = result.rows[0]
  if (!row) {
    ;(req.session as { userId?: string }).userId = undefined
    res.status(401).json({ error: "User not found" })
    return
  }
  res.json({
    user: {
      id: row.id,
      email: row.email,
      name: row.name ?? undefined,
      isAdmin: isAdminEmail(row.email),
    },
  })
}

export async function register(req: Request, res: Response): Promise<void> {
  if (!authEnabled()) {
    res.status(400).json({ error: "Auth not enabled" })
    return
  }
  const { email, password, name } = req.body as { email?: string; password?: string; name?: string }
  const e = (email && String(email).trim().toLowerCase()) || ""
  const p = typeof password === "string" ? password : ""
  const n = (name && String(name).trim()) || ""

  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    res.status(400).json({ error: "Email không hợp lệ" })
    return
  }
  if (p.length < 6) {
    res.status(400).json({ error: "Mật khẩu tối thiểu 6 ký tự" })
    return
  }

  const existing = await query<{ id: string }>(withSchema(`SELECT id FROM __SCHEMA__.users WHERE email = $1`), [e])
  if (existing.rows.length > 0) {
    res.status(409).json({ error: "Email đã được đăng ký" })
    return
  }

  const hash = await bcrypt.hash(p, SALT_ROUNDS)
  const idResult = await query<{ id: string }>(
    withSchema(`INSERT INTO __SCHEMA__.users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id`),
    [e, hash, n || null]
  )
  const id = idResult.rows[0].id
  ;(req.session as { userId?: string; email?: string; name?: string }).userId = id
  ;(req.session as { userId?: string; email?: string; name?: string }).email = e
  ;(req.session as { userId?: string; email?: string; name?: string }).name = n || e
  req.session.save((err) => {
    if (err) {
      console.error("[quantis-auth] session save:", err)
      res.status(500).json({ error: "Lỗi phiên đăng nhập" })
      return
    }
    res.json({
      user: {
        id,
        email: e,
        name: n || undefined,
        isAdmin: isAdminEmail(e),
      },
    })
  })
}

export async function login(req: Request, res: Response): Promise<void> {
  if (!authEnabled()) {
    res.status(400).json({ error: "Auth not enabled" })
    return
  }
  const { email, password } = req.body as { email?: string; password?: string }
  const e = (email && String(email).trim().toLowerCase()) || ""
  const p = typeof password === "string" ? password : ""

  if (!e || !p) {
    res.status(400).json({ error: "Email và mật khẩu không được để trống" })
    return
  }

  const result = await query<{ id: string; email: string; name: string | null; password_hash: string }>(
    withSchema(`SELECT id, email, name, password_hash FROM __SCHEMA__.users WHERE email = $1`),
    [e]
  )
  const row = result.rows[0]
  if (!row || !row.password_hash) {
    res.status(401).json({ error: "Email hoặc mật khẩu không đúng" })
    return
  }
  const ok = await bcrypt.compare(p, row.password_hash)
  if (!ok) {
    res.status(401).json({ error: "Email hoặc mật khẩu không đúng" })
    return
  }
  ;(req.session as { userId?: string; email?: string; name?: string }).userId = row.id
  ;(req.session as { userId?: string; email?: string; name?: string }).email = row.email
  ;(req.session as { userId?: string; email?: string; name?: string }).name = row.name ?? row.email
  req.session.save((err) => {
    if (err) {
      console.error("[quantis-auth] session save:", err)
      res.status(500).json({ error: "Lỗi phiên đăng nhập" })
      return
    }
    res.json({
      user: {
        id: row.id,
        email: row.email,
        name: row.name ?? undefined,
        isAdmin: isAdminEmail(row.email),
      },
    })
  })
}

export async function logout(req: Request, res: Response): Promise<void> {
  req.session.destroy((err) => {
    if (err) console.error("[quantis-auth] session destroy:", err)
    res.json({ ok: true })
  })
}

export async function ssoStart(req: Request, res: Response): Promise<void> {
  if (!authEnabled()) {
    res.status(400).json({ error: "Auth not enabled" })
    return
  }
  if (!SSO_ISSUER_URL || !SSO_CLIENT_ID || !SSO_CLIENT_SECRET || !SSO_CALLBACK_URL) {
    res.status(503).json({ error: "SSO chưa được cấu hình" })
    return
  }
  try {
    const url = await getAuthorizationUrl(req)
    res.redirect(url)
  } catch (err) {
    console.error("[quantis-auth] SSO start:", err)
    res.status(500).json({ error: "Lỗi SSO" })
  }
}

export async function ssoCallback(req: Request, res: Response): Promise<void> {
  if (!authEnabled()) {
    res.status(400).json({ error: "Auth not enabled" })
    return
  }
  try {
    const redirectTo = await handleOidcCallback(req)
    res.redirect(redirectTo)
  } catch (err) {
    console.error("[quantis-auth] SSO callback:", err)
    const base = req.protocol + "://" + req.get("host") + "/"
    res.redirect(base + "?sso_error=1")
  }
}
