import { Ewma, EwmaOptions } from './ewma'

export class LoadBalancer<TKey> {
  private readonly ewmas: Map<TKey, Ewma>

  private readonly clock: () => number

  constructor(
    private readonly keys: TKey[],
    options: { ewma?: Omit<EwmaOptions, 'clock'>; clock?: () => number } = {},
  ) {
    this.clock = options.clock ?? (() => Date.now())
    this.ewmas = new Map(
      this.keys.map((key) => [
        key,
        new Ewma({
          ...options.ewma,
          clock: this.clock,
        }),
      ]),
    )
  }

  private pickKeyIndex(): number {
    return Math.floor(Math.random() * this.keys.length)
  }

  private pickRandomKeys(): [TKey, TKey] {
    if (this.keys.length <= 1) {
      const only = this.keys[0]
      return [only, only]
    }
    const i1 = this.pickKeyIndex()
    let i2 = this.pickKeyIndex()
    if (i2 === i1) {
      i2 = (i1 + 1) % this.keys.length
    }
    return [this.keys[i1], this.keys[i2]]
  }

  async execute<TResult>(fn: (key: TKey) => Promise<TResult>): Promise<TResult> {
    const [k1, k2] = this.pickRandomKeys()
    const [ewma1, ewma2] = [this.ewmas.get(k1), this.ewmas.get(k2)]
    if (!ewma1 || !ewma2) {
      throw new Error('No EWMA found')
    }

    // nginx ewma.lua picks the endpoint with the lowest decayed EWMA score.
    const k1Cost = ewma1.getEffectiveRttMs()
    const k2Cost = ewma2.getEffectiveRttMs()

    const pickedKey = k1Cost < k2Cost ? k1 : k2
    const pickedEwma = pickedKey === k1 ? ewma1 : ewma2
    const startTime = this.clock()
    try {
      return await fn(pickedKey)
    } finally {
      pickedEwma.observe(this.clock() - startTime)
    }
  }
}
