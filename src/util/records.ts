import { isExternal } from '../lexicon/types/app/bsky/embed/external'
import { Record as PostRecord } from '../lexicon/types/app/bsky/feed/post'
import { RichText } from '@atproto/api'

export const getKickstarterLinks = (record: PostRecord): string[] => {
  const links: string[] = []

  const rt = new RichText({
    text: record.text,
    facets: record.facets,
  })
  for (const segment of rt.segments()) {
    if (segment.isLink()) {
      if (segment.link?.uri.includes('kickstarter.com')) {
        console.log(`Got one! ${segment.link.uri}`)
        links.push(segment.link.uri)
      }
    }
  }

  if (record.embed && isExternal(record.embed)) {
    if (record.embed.uri.includes('kickstarter.com')) {
      console.log(`Got one in an embed! ${record.embed.uri}`)
      links.push(record.embed.uri)
    }
  }

  return links
}
