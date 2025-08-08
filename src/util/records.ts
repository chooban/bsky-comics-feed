import { RichText } from '@atproto/api'
import { isKickstarterUrl } from './kickstarter.js'
import { AppBskyFeedPost } from '@atcute/bluesky'
import { is } from '@atcute/lexicons'

export const getKickstarterLinks = (record: unknown): string[] => {
  const links: string[] = []
  if (!is(AppBskyFeedPost.mainSchema, record)) {
    return []
  }
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

  const embed = record.embed
  if (embed?.$type == 'app.bsky.embed.external') {
    if (isKickstarterUrl(embed.external.uri)) {
      console.log(`Got one in an embed! ${embed.external.uri}`)
      links.push(embed.external.uri)
    }
  }

  return links
}
