import { isExternal } from '../lexicon/types/app/bsky/embed/external'
import { RichText } from '@atproto/api'
import { isKickstarterUrl } from './kickstarter'
import { AppBskyFeedPost } from '@atproto/api'

export const getKickstarterLinks = (
  record: AppBskyFeedPost.Record,
): string[] => {
  const links: string[] = []

  const rt = new RichText({
    text: record.text,
    facets: record.facets,
  })
  for (const segment of rt.segments()) {
    if (segment.isLink() && isKickstarterUrl(segment.link?.uri)) {
      console.log(`Got one! ${segment.link.uri}`)
      links.push(segment.link.uri)
    }
  }

  if (record.embed && isExternal(record.embed)) {
    if (isKickstarterUrl(record.embed.uri)) {
      console.log(`Got one in an embed! ${record.embed.uri}`)
      links.push(record.embed.uri)
    }
  }

  return links
}
