/**
 * OIDC (OpenID Connect) — giống SurveyLab.
 */
import { Issuer, Client, generators } from "openid-client"
import type { Request } from "express"
import { SSO_ISSUER_URL, SSO_CLIENT_ID, SSO_CLIENT_SECRET, SSO_CALLBACK_URL } from "../env.js"
import { query, withSchema } from "../db.js"

let cachedClient: Client | null = null

async function getClient(): Promise<Client> {
  if (cachedClient) return cachedClient
  if (!SSO_ISSUER_URL || !SSO_CLIENT_ID || !SSO_CLIENT_SECRET || !SSO_CALLBACK_URL) {
    throw new Error("SSO not configured")
  }
  const issuer = await Issuer.discover(SSO_ISSUER_URL)
  cachedClient = new issuer.Client({
    client_id: SSO_CLIENT_ID,
    client_secret: SSO_CLIENT_SECRET,
    redirect_uris: [SSO_CALLBACK_URL],
    response_types: ["code"],
    scope: "openid profile email",
  })
  return cachedClient
}

export async function getAuthorizationUrl(req: Request): Promise<string> {
  const client = await getClient()
  const state = generators.state()
  const codeVerifier = generators.codeVerifier()
  ;(req.session as { ssoState?: string; ssoCodeVerifier?: string }).ssoState = state
  ;(req.session as { ssoState?: string; ssoCodeVerifier?: string }).ssoCodeVerifier = codeVerifier
  return client.authorizationUrl({
    scope: "openid profile email",
    state,
    code_challenge: generators.codeChallenge(codeVerifier),
    code_challenge_method: "S256",
  })
}

export async function handleCallback(req: Request): Promise<string> {
  const client = await getClient()
  const sess = req.session as {
    ssoState?: string
    ssoCodeVerifier?: string
    userId?: string
    email?: string
    name?: string
  }
  const state = sess.ssoState
  const codeVerifier = sess.ssoCodeVerifier
  if (!state || !codeVerifier) throw new Error("Missing SSO state")
  const params = client.callbackParams(req)
  const tokenSet = await client.callback(SSO_CALLBACK_URL!, params, { state, code_verifier: codeVerifier })
  const userinfo = await client.userinfo(tokenSet.access_token!)
  const sub = String(userinfo.sub ?? "")
  const email = (userinfo.email && String(userinfo.email).trim().toLowerCase()) || ""
  const name =
    (userinfo.name && String(userinfo.name).trim()) ||
    (userinfo.preferred_username && String(userinfo.preferred_username)) ||
    email ||
    ""

  sess.ssoState = undefined
  sess.ssoCodeVerifier = undefined

  const provider = SSO_ISSUER_URL.replace(/\/$/, "").replace(/^https?:\/\//, "").split("/")[0]
  let existing = await query<{ id: string; email: string; name: string | null }>(
    withSchema(`SELECT id, email, name FROM __SCHEMA__.users WHERE sso_provider = $1 AND sso_sub = $2`),
    [provider, sub]
  )
  if (existing.rows.length > 0) {
    const row = existing.rows[0]
    sess.userId = row.id
    sess.email = row.email
    sess.name = row.name ?? row.email
    const base = req.protocol + "://" + req.get("host") + "/"
    return new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve(base)))
    })
  }
  const emailToUse = email || `sso-${sub}@local`
  const byEmail = await query<{ id: string }>(withSchema(`SELECT id FROM __SCHEMA__.users WHERE email = $1`), [emailToUse])
  if (byEmail.rows.length > 0) {
    await query(
      withSchema(
        `UPDATE __SCHEMA__.users SET sso_provider = $1, sso_sub = $2, name = COALESCE(NULLIF(TRIM(name), ''), $3) WHERE id = $4::uuid`
      ),
      [provider, sub, name || null, byEmail.rows[0].id]
    )
    sess.userId = byEmail.rows[0].id
    sess.email = emailToUse
    sess.name = name || emailToUse
    const base = req.protocol + "://" + req.get("host") + "/"
    return new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve(base)))
    })
  } else {
    const insert = await query<{ id: string }>(
      withSchema(
        `INSERT INTO __SCHEMA__.users (email, name, sso_provider, sso_sub) VALUES ($1, $2, $3, $4) RETURNING id`
      ),
      [emailToUse, name || null, provider, sub]
    )
    const id = insert.rows[0].id
    sess.userId = id
    sess.email = emailToUse
    sess.name = name || emailToUse
  }
  const base = req.protocol + "://" + req.get("host") + "/"
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve(base)))
  })
}
