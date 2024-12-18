import { canonicalizeKickstarterUrl, isKickstarterUrl } from './kickstarter'

describe('Kickstarter utility functions', () => {
  describe('isKickstarterUrl', () => {
    it('should return true for valid Kickstarter URLs', () => {
      expect(isKickstarterUrl('https://www.kickstarter.com/projects/123456789/test-project')).toBe(true)
      expect(isKickstarterUrl('https://kck.st/123456789')).toBe(true)
    })

    it('should return false for invalid Kickstarter URLs', () => {
      expect(isKickstarterUrl('https://www.google.com')).toBe(false)
      expect(isKickstarterUrl('https://www.kickstarter.com')).toBe(false)
      expect(isKickstarterUrl('https://kck.st')).toBe(false)
    })
  })

  describe('canonicalizeKickstarterUrl', () => {
    it('should return null for non-Kickstarter URLs', async () => {
      expect(await canonicalizeKickstarterUrl('https://www.google.com')).toBe(null)
    })

    it('should return a canonical URL for valid Kickstarter URLs', async () => {
      expect(await canonicalizeKickstarterUrl('https://www.kickstarter.com/projects/123456789/test-project')).toBe('https://www.kickstarter.com/projects/123456789/test-project')
      expect(await canonicalizeKickstarterUrl('https://kck.st/123456789')).toBe('https://www.kickstarter.com/projects/123456789/test-project')
    })
  })
})
