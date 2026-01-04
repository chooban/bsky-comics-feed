import { AtpAgent } from '@atproto/api'

const agent = new AtpAgent({
  service: 'https://public.api.bsky.app',
})

export type ProfileData = {
  handle: string
  avatar: string | null
  displayName: string | null
}

/**
 * Fetch a Bluesky user profile by DID
 * Returns null if the DID cannot be resolved to a profile
 */
export async function getProfileByDid(
  did: string,
): Promise<ProfileData | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await agent.app.bsky.actor.getProfile({ actor: did })
    
    return {
      handle: response.data.handle,
      avatar: response.data.avatar || null,
      displayName: response.displayName || null,
    }
  } catch (error) {
    // Silently fail - return null if DID cannot be resolved
    console.debug(`Could not resolve DID: ${did}`, error)
    return null
  }
}
