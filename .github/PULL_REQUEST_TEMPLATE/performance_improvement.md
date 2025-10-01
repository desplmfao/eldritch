---
name: performance improvement
about: propose a change that is focused on improving performance.
title: "[perf] "
labels: performance
assignees: ''

---

## summary of optimization

<!-- a clear and concise description of the performance improvement. what part of the engine is being optimized and what is the approach? -->

## related issue(s)

<!-- link to any related performance issue here. ex: closes #123 -->

- closes #

## benchmark results

<!--
this section is required. please provide concrete benchmark data that demonstrates the performance improvement.
- run benchmarks multiple times to ensure results are stable.
- the code used for benchmarking **must** be included in this pull request.
-->

### author's benchmarks

---

#### environment: [describe the machine, e.g., author's primary desktop]

| component       | specification                      | notes                       |
| :-------------- | :--------------------------------- | :-------------------------- |
| **os**          | `[e.g., arch linux]`               |                             |
| **cpu**         | `[e.g., amd ryzen 9 9950x3d]`      |                             |
| **memory**      | `[e.g., 64gb ddr5 6400mhz]`        |                             |
| **gpu**         | `[e.g., nvidia rtx 2080 ti]`       |                             |
| **bun version** | `[e.g., v1.2.22]`                  | run `bun --version`         |

##### benchmark: [describe scenario 1, e.g., high entity count query]

**before:**
```sh
# paste the full benchmark output from the `main` branch here for scenario 1
```

**after:**
```sh
# paste the full benchmark output from your feature branch here for scenario 1
```

---

<!-- to add benchmarks from another machine, copy the entire block from the `#### environment` line to the `---` line above and paste it here. -->

### community benchmarks

> **for reviewers:** if you are able to, please run the benchmarks on your own hardware and post the results in a comment below using the same format as the author's benchmarks. this helps us understand the impact of this change across different systems.

## analysis

<!-- a brief analysis of the results. how does this change achieve the performance improvement? are there any potential trade-offs (e.g., increased memory usage, reduced readability, big o)? -->

## checklist

- [ ] i have read the [contributing guidelines](/.github/CONTRIBUTING.md).
- [ ] i have provided clear benchmark data to validate the performance improvement, including my environment details.
- [ ] **the benchmark code used to generate these results is included in this pull request.**
- [ ] i have added or updated tests to cover any new or changed logic.
- [ ] all new and existing tests passed.