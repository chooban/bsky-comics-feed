export const canonicalizeCrowdfundingUrl = async (
  url: string,
): Promise<string | null> => {
  if (!isCrowdfundingUrl(url)) {
    return null
  }

  const u = new URL(url)
  if (u.pathname === '/') {
    return null
  }

  if (u.hostname === 'kck.st') {
    const redirect = await fetch(u, { redirect: 'manual' })
    const redirectUrl = redirect.headers.get('location')

    if (!redirectUrl) {
      console.log(`Did not get a redirect from ${u.toString()}`)
      return null
    }
    return canonicalizeCrowdfundingUrl(redirectUrl)
  }

  if (u.hostname.endsWith('fundmycomic.com') || u.hostname.endsWith('zoop.gg') || u.hostname.endsWith('indiegogo.com')) {
    return u.origin + u.pathname.replace(/\/$/, '')
  }

  const urlParts = u.pathname.split('/')
  if (urlParts.length < 3) {
    return null
  }

  if (urlParts[1] !== 'projects') {
    console.log(`Ignoring non-project URL: ${url}`)
    return null
  }

  const newUri = `${u.origin}${urlParts.slice(0, 4).join('/')}`

  return newUri
}

export const isCrowdfundingUrl = (url: string | undefined): url is string => {
  if (!url) {
    return false
  }
  return (
    (url.includes('kickstarter.com') ||
      url.includes('kck.st') ||
      url.includes('fundmycomic.com') ||
      url.includes('zoop.gg') ||
      url.includes('indiegogo.com')) &&
    !(url.includes('...') || url.includes('%E2%80%A6') || url.includes('…'))
  )
}

/** @deprecated Use canonicalizeCrowdfundingUrl instead */
export const canonicalizeKickstarterUrl = canonicalizeCrowdfundingUrl

/** @deprecated Use isCrowdfundingUrl instead */
export const isKickstarterUrl = isCrowdfundingUrl
