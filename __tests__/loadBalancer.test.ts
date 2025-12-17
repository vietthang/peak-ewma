import { LoadBalancer } from '../src/load-balancer'

describe('LoadBalancer', () => {
  const decayTimeMs = 1_000

  it('picks the second key on an initial tie (strict < comparison)', async () => {
    const now = 0
    const clock = () => now
    const lb = new LoadBalancer(['a', 'b'], { clock, ewma: { decayTimeMs } })

    const rnd = jest.spyOn(Math, 'random').mockReturnValue(0)
    const picked = await lb.execute(async (key) => key)
    expect(picked).toBe('b')
    rnd.mockRestore()
  })

  it('avoids a key after it observes a higher RTT (prefers lower EWMA)', async () => {
    let now = 0
    const clock = () => now
    const lb = new LoadBalancer(['a', 'b'], { clock, ewma: { decayTimeMs } })

    // Always pick pair [a, b] so tie initially selects 'b'
    const rnd = jest.spyOn(Math, 'random').mockReturnValue(0)

    // Warm up: first call is a tie (0 vs 0), so it picks 'b'. Simulate high latency.
    const firstPicked = await lb.execute(async (key) => {
      now += 100
      return key
    })
    expect(firstPicked).toBe('b')

    // Next call should prefer 'a' because 'b' has a higher EWMA now.
    const secondPicked = await lb.execute(async (key) => {
      // Low latency for whichever gets picked
      now += 10
      return key
    })
    expect(secondPicked).toBe('a')

    rnd.mockRestore()
  })

  it('updates EWMA even if the provided function throws (finally block)', async () => {
    let now = 0
    const clock = () => now
    const lb = new LoadBalancer(['a', 'b'], { clock, ewma: { decayTimeMs } })

    const rnd = jest.spyOn(Math, 'random').mockReturnValue(0)

    // First call: tie picks 'b'; simulate a long duration and then throw
    await expect(
      lb.execute(async () => {
        now += 200
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')

    // Next call should avoid 'b' (now high EWMA) and pick 'a'
    const picked = await lb.execute(async (key) => {
      now += 10
      return key
    })
    expect(picked).toBe('a')

    rnd.mockRestore()
  })

  it('works with a single key list', async () => {
    let now = 0
    const clock = () => now
    const lb = new LoadBalancer(['solo'], { clock, ewma: { decayTimeMs } })

    const picked = await lb.execute(async (key) => {
      now += 50
      return key
    })
    expect(picked).toBe('solo')
  })
})
