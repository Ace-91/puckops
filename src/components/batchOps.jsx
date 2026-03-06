
/**
 * Processes items in concurrent batches to maximize throughput
 * while avoiding rate limits. Default: 5 concurrent, 150ms between batches.
 */
async function batchProcess(items, fn, onProgress, cancelRef, concurrency = 5, batchDelay = 150) {
  let completed = 0;
  for (let i = 0; i < items.length; i += concurrency) {
    if (cancelRef?.current) break;
    const chunk = items.slice(i, i + concurrency);
    await Promise.all(chunk.map(item => fn(item)));
    completed += chunk.length;
    onProgress(Math.min(completed, items.length), items.length);
    if (i + concurrency < items.length) await new Promise(r => setTimeout(r, batchDelay));
  }
}

/**
 * Rate-limit-safe sequential deleter.
 * delay=300ms between each operation to avoid 429 errors.
 * cancelRef.current = true stops the loop early.
 */
export async function batchDelete(ids, deleteFn, onProgress, cancelRef) {
  await batchProcess(ids, id => deleteFn(id), onProgress, cancelRef);
}

export async function batchUpdate(items, updateFn, onProgress, cancelRef) {
  await batchProcess(items, item => updateFn(item), onProgress, cancelRef);
}
