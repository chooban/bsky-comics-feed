import { RichText } from '@atproto/api'
import { isCrowdfundingUrl } from './crowdfunding.js'
import { AppBskyFeedPost } from '@atcute/bluesky'
import { is } from '@atcute/lexicons'

export const getCrowdfundingLinks = (record: unknown): string[] => {
  const links: string[] = []
  if (!is(AppBskyFeedPost.mainSchema, record)) {
    return []
  }
  const rt = new RichText({
    text: record.text,
    facets: record.facets,
  })
  for (const segment of rt.segments()) {
    if (segment.isLink() && isCrowdfundingUrl(segment.link?.uri)) {
      links.push(segment.link.uri)
    }
  }

  const embed = record.embed
  if (embed?.$type == 'app.bsky.embed.external') {
    if (isCrowdfundingUrl(embed.external.uri)) {
      links.push(embed.external.uri)
    }
  }

  return Array.from(new Set(links))
}
