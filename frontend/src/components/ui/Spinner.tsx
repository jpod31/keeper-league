/**
 * No-op inline loader — page transitions are fast enough that a visible
 * spinner added more visual noise than it solved. Kept as an exported
 * component so every `<Spinner />` callsite still compiles.
 */
export function Spinner(_: { text?: string } = {}) {
  return null
}
