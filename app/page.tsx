'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard')
      } else {
        router.push('/login')
      }
    })
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
