/** Runs independent work concurrently while preserving caller-supplied order. */
export async function runOrderedParallel<T, R>(
  values: readonly T[],
  workers: number,
  execute: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let nextIndex = 0
  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await execute(values[index]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(workers, values.length) }, worker))
  return results
}
