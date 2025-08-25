import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
})

// Database types
export interface User {
  id: string
  email: string
  created_at: string
  notification_preferences: {
    enabled: boolean
    frequency: 'daily' | 'weekly' | 'random'
    start_time?: string
    end_time?: string
  }
}

export interface Reminder {
  id: string
  user_id: string
  scheduled_at: string
  expires_at: string
  status: 'pending' | 'active' | 'completed' | 'expired'
  created_at: string
}

export interface Photo {
  id: string
  user_id: string
  reminder_id: string
  photo_url: string
  uploaded_at: string
  created_at: string
}
