import { Ewma } from '../src/ewma'

describe('Ewma', () => {
  it('starts at the configured initial RTT (default 0ms like nginx)', () => {
    const ewmaDefault = new Ewma()
    expect(ewmaDefault.getEffectiveRttMs()).toBeCloseTo(0, 4)

    const ewmaCustom = new Ewma({ initialRttMs: 50 })
    expect(ewmaCustom.getEffectiveRttMs()).toBeCloseTo(50, 4)
  })

  it('first observation at the same time does not change EWMA', () => {
    const now = 0
    const clock = () => now
    const ewma = new Ewma({ clock, decayTimeMs: 1_000, initialRttMs: 50 })

    ewma.observe(100)
    // With zero elapsed time, the stored EWMA remains unchanged.
    expect(ewma.getEffectiveRttMs()).toBeCloseTo(50, 4)
  })

  it('updates EWMA with exponential decay between observations', () => {
    let now = 0
    const clock = () => now
    const ewma = new Ewma({ clock, decayTimeMs: 1_000, initialRttMs: 50 })

    // After 1 * decayTime, weightOld = exp(-1)
    now = 1_000
    ewma.observe(100)
    const w = Math.exp(-1)
    const expected1 = 50 * w + 100 * (1 - w)
    expect(ewma.getEffectiveRttMs()).toBeCloseTo(expected1, 4)

    // After another 1 * decayTime, observe 300:
    now = 2_000
    ewma.observe(300)
    const expected2 = expected1 * w + 300 * (1 - w)
    expect(ewma.getEffectiveRttMs()).toBeCloseTo(expected2, 4)
  })

  it('effective RTT decays over time without new observations (score on read)', () => {
    let now = 0
    const clock = () => now
    const decayTimeMs = 1_000
    const ewma = new Ewma({ clock, decayTimeMs, initialRttMs: 80 })

    expect(ewma.getEffectiveRttMs()).toBeCloseTo(80, 6)
    now = 5_000
    // No observe calls; score should decay with exp(-delta/decayTimeMs)
    const expected = 80 * Math.exp(-5_000 / decayTimeMs)
    expect(ewma.getEffectiveRttMs()).toBeCloseTo(expected, 4)
  })
})
