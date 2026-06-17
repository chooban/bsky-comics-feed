import { canonicalizeCrowdfundingUrl, isCrowdfundingUrl } from './crowdfunding'

describe('Crowdfunding utility functions', () => {
  describe('isCrowdfundingUrl', () => {
    it('should return true for valid Kickstarter URLs', () => {
      expect(
        isCrowdfundingUrl(
          'https://www.kickstarter.com/projects/123456789/test-project',
        ),
      ).toBe(true)
      expect(isCrowdfundingUrl('https://kck.st/123456789')).toBe(true)
    })

    it('should return true for valid FundMyComic URLs', () => {
      expect(
        isCrowdfundingUrl('https://www.fundmycomic.com/titan-mouse-10'),
      ).toBe(true)
      expect(
        isCrowdfundingUrl('https://fundmycomic.com/some-campaign'),
      ).toBe(true)
    })

    it('should return true for valid Zoop URLs', () => {
      expect(isCrowdfundingUrl('https://zoop.gg/c/talesofthemacabre')).toBe(
        true,
      )
      expect(isCrowdfundingUrl('https://www.zoop.gg/c/some-campaign')).toBe(
        true,
      )
    })

    it('should return true for valid Indiegogo URLs', () => {
      expect(
        isCrowdfundingUrl(
          'https://www.indiegogo.com/en/projects/keithmorange/skylights',
        ),
      ).toBe(true)
      expect(
        isCrowdfundingUrl('https://indiegogo.com/projects/test'),
      ).toBe(true)
    })

    it('should return false for invalid URLs', () => {
      expect(isCrowdfundingUrl('https://www.google.com')).toBe(false)
      expect(isCrowdfundingUrl('https://www.kickstarter.com')).toBe(true)
      expect(isCrowdfundingUrl('https://kck.st')).toBe(true)
      expect(isCrowdfundingUrl('https://www.fundmycomic.com')).toBe(true)
      expect(isCrowdfundingUrl('https://zoop.gg')).toBe(true)
      expect(isCrowdfundingUrl('https://www.indiegogo.com')).toBe(true)
    })
  })

  describe('canonicalizeCrowdfundingUrl', () => {
    it('should return null for non-crowdfunding URLs', async () => {
      expect(await canonicalizeCrowdfundingUrl('https://www.google.com')).toBe(
        null,
      )
    })

    it('should return a canonical URL for valid Kickstarter URLs', async () => {
      expect(
        await canonicalizeCrowdfundingUrl(
          'https://www.kickstarter.com/projects/123456789/test-project',
        ),
      ).toBe('https://www.kickstarter.com/projects/123456789/test-project')
    })

    it('should return the URL as-is for FundMyComic URLs', async () => {
      expect(
        await canonicalizeCrowdfundingUrl(
          'https://www.fundmycomic.com/titan-mouse-10',
        ),
      ).toBe('https://www.fundmycomic.com/titan-mouse-10')
    })

    it('should strip trailing slash from FundMyComic URLs', async () => {
      expect(
        await canonicalizeCrowdfundingUrl(
          'https://www.fundmycomic.com/titan-mouse-10/',
        ),
      ).toBe('https://www.fundmycomic.com/titan-mouse-10')
    })

    it('should return the URL as-is for Zoop URLs', async () => {
      expect(
        await canonicalizeCrowdfundingUrl(
          'https://zoop.gg/c/talesofthemacabre',
        ),
      ).toBe('https://zoop.gg/c/talesofthemacabre')
    })

    it('should return a canonical URL for Indiegogo URLs', async () => {
      expect(
        await canonicalizeCrowdfundingUrl(
          'https://www.indiegogo.com/en/projects/keithmorange/skylights',
        ),
      ).toBe('https://www.indiegogo.com/en/projects/keithmorange/skylights')
    })
  })
})
