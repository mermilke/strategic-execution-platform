import { createHash, timingSafeEqual } from 'crypto'

// Constant-time compare so the header check doesn't leak the secret through
// response timing. Hashing both sides first makes the buffers equal length
// (timingSafeEqual throws otherwise) and hides their lengths too.
function safeEqual(a: string, b: string) {
  const ah = createHash('sha256').update(a).digest()
  const bh = createHash('sha256').update(b).digest()
  return timingSafeEqual(ah, bh)
}

// Shared Bearer check for the cron endpoints. Fails CLOSED: with no CRON_SECRET
// configured the endpoint stays locked rather than open to anyone, since these
// routes send email / spend AI budget.
export function verifyCronAuth(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || !authHeader) return false
  return safeEqual(authHeader, `Bearer ${cronSecret}`)
}
