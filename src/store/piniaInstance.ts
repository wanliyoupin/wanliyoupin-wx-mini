import type { Pinia } from 'pinia'

let _pinia: Pinia | null = null

export function setPinia(p: Pinia) {
  _pinia = p
}

export function getPinia(): Pinia | null {
  return _pinia
}
