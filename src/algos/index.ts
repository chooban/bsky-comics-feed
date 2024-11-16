import { AppContext } from '../config'
import {
  QueryParams,
  OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { buildFeed } from './kickstarter-algo'

type AlgoHandler = (ctx: AppContext, params: QueryParams) => Promise<AlgoOutput>

const comicsCategories = [
  'Comic Books',
  'Graphic Novels',
  'Webcomics',
  'Comics',
]

const tabletopGames = ['Tabletop Games']

const algos: Record<string, AlgoHandler> = {
  cfcomics: buildFeed(comicsCategories),
  cfttg: buildFeed(tabletopGames),
}

export default algos
