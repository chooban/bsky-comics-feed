import { RichText } from '@atproto/api'
import { isKickstarterUrl } from './kickstarter'
import { AppBskyFeedPost } from '@atproto/api'
import { hasProp } from './has-prop'

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

  if (record.embed) {
    const embed = record.embed
    if (hasProp(embed, 'uri')) {
      if (isKickstarterUrl(embed.uri as string)) {
        console.log(`Got one in an embed! ${embed.uri}`)
        links.push(embed.uri as string)
      }
    }
  }

  return links
}
