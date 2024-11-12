import { AppContext } from '../config'
import {
  QueryParams,
  OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import * as comics from './comics'
import * as tabletop from './tabletop'

type AlgoHandler = (ctx: AppContext, params: QueryParams) => Promise<AlgoOutput>

const algos: Record<string, AlgoHandler> = {
  [comics.shortname]: comics.handler,
  [tabletop.shortname]: tabletop.handler,
}

export default algos
