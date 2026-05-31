import { describe, expect, it } from 'vitest'

import {
  shouldBlockTimerStartWithoutRoblox,
  shouldPauseTimerWhenRobloxMissing,
} from '../src/shared/robloxSync'

describe('Roblox/timer synchronization policy', () => {
  it('pauses an active timer as soon as Roblox is no longer running', () => {
    expect(shouldPauseTimerWhenRobloxMissing(true, false)).toBe(true)
    expect(shouldPauseTimerWhenRobloxMissing(true, true)).toBe(false)
    expect(shouldPauseTimerWhenRobloxMissing(false, false)).toBe(false)
  })

  it('blocks packaged timer starts when Roblox is not running', () => {
    expect(shouldBlockTimerStartWithoutRoblox(true, false)).toBe(true)
    expect(shouldBlockTimerStartWithoutRoblox(true, true)).toBe(false)
  })

  it('allows non-packaged dev starts for local UI/test work', () => {
    expect(shouldBlockTimerStartWithoutRoblox(false, false)).toBe(false)
  })
})
