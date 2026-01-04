/**
 * Utilities for working with Bluesky post URIs
 */

/**
 * Extract post ID from AT Protocol URI
 * Input: at://did:plc:abc123/app.bsky.feed.post/3l7m6ivb6ha2q
 * Output: 3l7m6ivb6ha2q
 */
export function extractPostIdFromUri(uri: string): string | null {
  const match = uri.match(/\/app\.bsky\.feed\.post\/([a-z0-9]+)$/i)
  return match ? match[1] : null
}

/**
 * Build Bluesky post URL from author handle and post ID
 * Input: author = "darn.es", postId = "3l7m6ivb6ha2q"
 * Output: https://bsky.app/profile/darn.es/post/3l7m6ivb6ha2q
 */
export function buildBskyUrl(author: string, postId: string): string {
  return `https://bsky.app/profile/${author}/post/${postId}`
}

/**
 * Convert AT Protocol URI to Bluesky post URL
 * Input: uri = "at://did:plc:abc/app.bsky.feed.post/3l7m6ivb", author = "user.bsky.social"
 * Output: https://bsky.app/profile/user.bsky.social/post/3l7m6ivb
 */
export function atUriToBskyUrl(uri: string, author: string): string | null {
  const postId = extractPostIdFromUri(uri)
  if (!postId) return null
  return buildBskyUrl(author, postId)
}
