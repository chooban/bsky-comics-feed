import { isExternal } from '../lexicon/types/app/bsky/embed/external'
import { Record as PostRecord } from '../lexicon/types/app/bsky/feed/post'
import { RichText } from '@atproto/api'

export const getLinks = (record: PostRecord): string[] => {
  const links: string[] = []

  const rt = new RichText({
    text: record.text,
    facets: record.facets,
  })
  for (const segment of rt.segments()) {
    if (segment.isLink()) {
      if (segment.link?.uri.includes('kickstarter.com')) {
        console.log(`Got one! ${segment.link.uri}`)
        const uri = sanitizeLink(segment.link.uri)
        if (uri !== null) {
          links.push(uri)
        }
      }
    }
  }

  if (record.embed && isExternal(record.embed)) {
    if (record.embed.uri.includes('kickstarter.com')) {
      console.log(`Got one in an embed! ${record.embed.uri}`)
      const uri = sanitizeLink(record.embed.uri)
      if (uri !== null) {
        links.push(uri)
      }
    }
  }

  return links
}

const sanitizeLink = (uri: string): string | null => {
  const u = new URL(uri)
  if (u.pathname.length > 1) {
    return `${u.origin}${u.pathname}`
  }
  return null
}
