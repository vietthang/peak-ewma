export interface EwmaOptions {
  /**
   * Exponential decay time in milliseconds (matches nginx ewma.lua DECAY_TIME semantics).
   */
  decayTimeMs?: number
  /**
   * Initial RTT used to seed the EWMA (default 0 like nginx implementation).
   */
  initialRttMs?: number
  /**
   * Clock function returning current time in milliseconds.
   */
  clock?: () => number
}

const DEFAULT_CLOCK = () => performance.now()

export class Ewma {
  private readonly decayTimeMs: number
  private readonly clock: () => number

  private rttEwmaMs: number
  private lastUpdateEpochMs: number

  constructor(options: EwmaOptions = {}) {
    // nginx ewma.lua uses DECAY_TIME=10s and weight = exp(-td/DECAY_TIME)
    this.decayTimeMs = options.decayTimeMs ?? 10_000
    this.clock = options.clock ?? DEFAULT_CLOCK
    // nginx ewma.lua starts with 0 when no prior value exists
    this.rttEwmaMs = options.initialRttMs ?? 0
    this.lastUpdateEpochMs = this.clock()
  }

  /**
   * Record a new RTT observation in milliseconds.
   * The EWMA uses exponential decay: weight = exp(-delta/decayTimeMs).
   */
  observe(rttMs: number): void {
    const nowMs = this.clock()

    const last = this.lastUpdateEpochMs ?? nowMs
    const deltaMs = Math.max(0, nowMs - last)

    // Exponential decay factor (matches nginx ewma.lua):
    // weight_old = exp(-delta / DECAY_TIME)
    const weightOld = Math.exp(-(deltaMs / this.decayTimeMs))

    this.rttEwmaMs = this.rttEwmaMs * weightOld + rttMs * (1 - weightOld)
    this.lastUpdateEpochMs = nowMs
  }

  getEffectiveRttMs(): number {
    // Return a decayed view of the current EWMA score without mutating state.
    // This mirrors ewma.lua's get_or_update_ewma(upstream, 0, false) behavior,
    // which computes ewma * exp(-td/DECAY_TIME) for scoring without persisting it.
    const nowMs = this.clock()
    const last = this.lastUpdateEpochMs ?? nowMs
    const deltaMs = Math.max(0, nowMs - last)
    const weightOld = Math.exp(-(deltaMs / this.decayTimeMs))
    return this.rttEwmaMs * weightOld
  }
}
