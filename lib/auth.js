import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Server-side session check. Returns { user, profile } or null.
export async function getAuthenticatedUser() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('id, role, email, full_name')
    .eq('id', session.user.id)
    .single()

  if (!profile) return null

  return { user: session.user, profile }
}
