export type StartupWindowAction = 'show-main-window' | 'hide-to-tray' | 'keep-resumed-window'

export function decideStartupWindowAction(options: {
  startHidden: boolean
  resumedTimer: boolean
}): StartupWindowAction {
  if (options.resumedTimer) return 'keep-resumed-window'
  return options.startHidden ? 'hide-to-tray' : 'show-main-window'
}
