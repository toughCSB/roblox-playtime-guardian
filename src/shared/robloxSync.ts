export function shouldPauseTimerWhenRobloxMissing(timerRunning: boolean, robloxRunning: boolean): boolean {
  return timerRunning && !robloxRunning
}

export function shouldBlockTimerStartWithoutRoblox(isPackaged: boolean, robloxRunning: boolean): boolean {
  return isPackaged && !robloxRunning
}
