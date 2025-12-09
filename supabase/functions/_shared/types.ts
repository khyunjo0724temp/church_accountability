// 공통 타입 정의

export type UserRole = 'super-admin' | 'team-leader' | 'zone-leader' | 'pastor' | 'member'

export interface User {
  id: string
  name: string
  phone: string
  pin_hash: string
  role: UserRole
  team_id: string | null
  approved: boolean
  created_at: string
  updated_at: string
}

export interface Team {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface Member {
  id: string
  team_id: string
  name: string
  phone: string | null
  is_newbie: boolean
  zone_leader_id: string | null
  created_at: string
  updated_at: string
}

export interface ZoneLeader {
  id: string
  user_id: string | null
  team_id: string
  name: string
  phone: string | null
  created_at: string
  updated_at: string
}

export interface AttendanceRecord {
  id: string
  team_id: string
  member_id: string
  week_start_date: string
  present: boolean
  created_at: string
  updated_at: string
}

export interface Referral {
  id: string
  new_member_id: string
  referrer_id: string | null
  referrer_type: 'member' | 'zone-leader' | 'external'
  depth: number
  team_id: string
  date: string
  created_at: string
}

export interface Point {
  id: string
  team_id: string
  user_id: string | null
  member_id: string | null
  zone_leader_id: string | null
  points: number
  reason: string
  week_start_date: string | null
  date: string
  metadata: any
  created_at: string
}

export interface ApiResponse<T = any> {
  ok: boolean
  data?: T
  error?: string
  message?: string
}
