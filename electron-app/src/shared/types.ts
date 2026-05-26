export interface Settings {
  weekdayLimit: number
  weekendLimit: number
  customDays?: Record<string, number>
  allowedStartHour: number
  allowedEndHour: number
  updatedAt: string
}

export interface Session {
  id: string
  date: string
  startTime: string
  endTime: string
  duration: number
  limitAtSession: number
  terminated: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  weekdayLimit: 30,
  weekendLimit: 60,
  allowedStartHour: 16,
  allowedEndHour: 21,
  updatedAt: new Date().toISOString(),
}
