export function formatSlug(slug: string): string {
  if (!slug) return ''
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
