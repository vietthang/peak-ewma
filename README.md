## peak-ewma

Exponential Weighted Moving Average (EWMA) primitives and a simple load balancer that chooses the endpoint with the lowest decayed RTT estimate (inspired by nginx `ewma.lua`).

### Install

```bash
npm install peak-ewma
```

### EWMA

The `Ewma` class tracks a decayed average of observed round-trip times. It supports a configurable decay time and initial value.

```ts
import { Ewma } from './src/ewma' // or from the package once exported

const ewma = new Ewma({ decayTimeMs: 10_000, initialRttMs: 50 })

// Record a new RTT (ms)
ewma.observe(120)

// Read the decayed, effective RTT without mutating state
const score = ewma.getEffectiveRttMs()
```

Options:

- `decayTimeMs` (default: 10000): exponential decay window in milliseconds.
- `initialRttMs` (default: 0): seed value to start from.
- `clock`: function returning current time in ms (defaults to `performance.now()`).

### LoadBalancer

`LoadBalancer<TKey>` holds an `Ewma` per key and, for each execution, compares two randomly selected keys, picking the one with the lower current effective RTT. It then measures the call duration and feeds it back into the EWMA for the chosen key.

```ts
import { LoadBalancer } from './src/load-balancer' // or from the package once exported

type Endpoint = { id: string; url: string }
const endpoints: Endpoint[] = [
  { id: 'a', url: 'https://a.example.com' },
  { id: 'b', url: 'https://b.example.com' },
]

// Use endpoint ids as keys
const lb = new LoadBalancer(
  endpoints.map((e) => e.id),
  { ewma: { decayTimeMs: 10_000 } },
)

// Execute a request against the chosen endpoint
const data = await lb.execute(async (id) => {
  const url = endpoints.find((e) => e.id === id)!.url
  const res = await fetch(url)
  return res.json()
})
```

Constructor:

```ts
new LoadBalancer<TKey>(
  keys: TKey[],
  options?: {
    ewma?: Omit<EwmaOptions, 'clock'> // forwarded to each Ewma
    clock?: () => number              // used for timing durations
  },
)
```

Notes:

- With a single key, it still works and always selects that key.
- On ties, strict comparison (`<`) means the second of the two sampled keys will be chosen.
- Failures still contribute timing (duration is recorded in a `finally` block).

### Development

Run tests:

```bash
npm test
```

Build:

```bash
npm run build
```

### License

Apache License 2.0. See the [LICENSE](./LICENSE) file for full text.
