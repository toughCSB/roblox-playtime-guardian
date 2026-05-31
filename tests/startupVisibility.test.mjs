import { describe, expect, it } from 'vitest'

import { decideStartupWindowAction } from '../src/shared/startupVisibility'

describe('startup window visibility', () => {
  it('shows the main window for a manual launch when no timer resumes', () => {
    expect(decideStartupWindowAction({ startHidden: false, resumedTimer: false })).toBe('show-main-window')
  })

  it('stays hidden for watchdog auto-start when no timer resumes', () => {
    expect(decideStartupWindowAction({ startHidden: true, resumedTimer: false })).toBe('hide-to-tray')
  })

  it('keeps the resumed timer window behavior independent of launch source', () => {
    expect(decideStartupWindowAction({ startHidden: false, resumedTimer: true })).toBe('keep-resumed-window')
    expect(decideStartupWindowAction({ startHidden: true, resumedTimer: true })).toBe('keep-resumed-window')
  })
})
