# ADR-001: Feed rendering model (CSR-first)

## Status

Accepted (current production reality)

## Context

Nuggets ships a CSR React app (`createRoot`), with crawler-only OG HTML.

## Decision

Keep CSR-first model for now while investing in bounded DOM (virtualization/windowing) and cheaper excerpt rendering paths.

## Consequences

- LCP tied to bundle + hydration cost unless mitigated via smaller JS and smarter feed rendering.

## References

- [`docs/perf/PERF_MASTER.md`](../PERF_MASTER.md)
- Route notes: [`../routes/home.md`](../routes/home.md)
