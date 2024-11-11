import { RichText } from '@atproto/api'

export const getLinks = (record: any): string[] => {
  const rt = new RichText({
    text: record.text,
    facets: record.facets,
  })
  const links: string[] = []
  for (const segment of rt.segments()) {
    if (segment.isLink()) {
      if (segment.link?.uri.includes('kickstarter.com')) {
        console.log(`Got one! ${segment.link?.uri}`)

        const u = new URL(segment.link.uri)
        if (u.pathname.length > 1) {
          links.push(`${u.origin}${u.pathname}`)
        }
      }
    }
  }
  return links
}
