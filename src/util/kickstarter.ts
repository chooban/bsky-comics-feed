export const canonicalizeKickstarterUrl = (url: string): string | null => {
  const u = new URL(url)
  if (u.pathname.length === 1) {
    // Was just a link to kickstarter
    return null
  }

  const urlParts = u.pathname.split('/')
  if (urlParts.length < 3) {
    // Should contain projects, a username, and a project slug
    return null
  }
  return `${u.origin}${urlParts.slice(0, 3).join('/')}`
}
