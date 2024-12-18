export const canonicalizeKickstarterUrl = async (
  url: string,
): Promise<string | null> => {
  /**
   * Returns null if it's not a link to a specific KS project
   */
  if (!isKickstarterUrl(url)) {
    return null
  }

  const u = new URL(url)
  if (u.pathname === '/') {
    // Was just a link to kickstarter
    return null
  }

  if (u.hostname === 'kck.st') {
    // It's a shortened URL. We need to request a redirect
    const redirect = await fetch(u, { redirect: 'manual' })
    const redirectUrl = redirect.headers.get('location')

    if (!redirectUrl) {
      console.log(`Did not get a redirect from ${u.toString()}`)
    } else {
      return canonicalizeKickstarterUrl(redirectUrl)
    }
  }

  const urlParts = u.pathname.split('/')
  if (urlParts.length < 3) {
    // Should contain projects, a username, and a project slug
    return null
  }

  if (urlParts[1] !== 'projects') {
    console.log(`Ignoring non-project URL: ${url}`)
    return null
  }

  const newUri = `${u.origin}${urlParts.slice(0, 4).join('/')}`

  return newUri
}

export const isKickstarterUrl = (url: string | undefined): url is string => {
  if (!url) {
    return false
  }
  return (
    (url.includes('kickstarter.com') || url.includes('kck.st')) &&
    !(url.includes('...') || url.includes('%E2%80%A6') || url.includes('…'))
  )
}
