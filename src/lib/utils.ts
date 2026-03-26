export function getToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function formatDuration(ms: number): string {
  if (ms < 0) return '—'
  const mins = Math.floor(ms / 60000)
  const hours = Math.floor(mins / 60)
  const remainMins = mins % 60
  if (hours > 0) return `${hours}h ${remainMins}m`
  return `${remainMins}m`
}

export function isAdminAuthed(request: Request): boolean {
  const url = new URL(request.url)
  const secret = url.searchParams.get('key') || url.pathname.split('/admin/')[1]?.split('/')[0]
  return secret === process.env.ADMIN_SECRET
}
