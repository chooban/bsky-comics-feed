import { validate as uuidValidate, v6 as generateV6 } from 'uuid'

export type UUID = string & { [$uuid]: true }
declare const $uuid: unique symbol

export function isUUID(value: unknown): value is UUID {
  return uuidValidate(value)
}

export function createUUID(): UUID {
  return generateV6() as UUID
}
