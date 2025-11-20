export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function parseDate(dateStr: string): Date {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`Invalid date string: ${dateStr}`)
  }
  return date
}

export function getBannerId(title: string, startDate: Date): string {
  const datePart = startDate.toISOString().split('T')[0]
  return `${normalizeName(title)}-${datePart}`
}
