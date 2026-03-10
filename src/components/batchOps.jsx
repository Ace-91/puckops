/**
 * Central batch operations utility.
 * Runs items in concurrent groups with a delay between groups to avoid rate limits.
 *
 * @param {Array}    items       - Array of items to process
 * @param {Function} fn          - Async function to call per item
 * @param {Function} onProgress  - (current, total) callback
 * @param {Object}   cancelRef   - { current: boolean } — set .current=true to abort
 * @param {number}   concurrency - Items per batch (default 8)
 * @param {number}   batchDelay  - ms between batches (default 600)
 */
export async function batchProcess(items, fn, onProgress = () => {}, cancelRef = null, concurrency = 20, batchDelay = 200) {
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
 * Batch delete — deletes items in groups, safe for large sets.
 */
export async function batchDelete(ids, deleteFn, onProgress = () => {}, cancelRef = null) {
  await batchProcess(ids, id => deleteFn(id), onProgress, cancelRef, 20, 200);
}

/**
 * Batch update — updates items in groups.
 * Each item should be { id, ...data } or whatever updateFn expects.
 */
export async function batchUpdate(items, updateFn, onProgress = () => {}, cancelRef = null) {
  await batchProcess(items, item => updateFn(item), onProgress, cancelRef, 20, 200);
}

/**
 * Bulk create in chunks — uses entity.bulkCreate per chunk.
 * Suitable for large datasets (e.g. schedule save, ice slot import).
 *
 * @param {Array}    items     - Full array of objects to create
 * @param {Function} bulkFn    - entity.bulkCreate function
 * @param {Function} onProgress
 * @param {number}   chunkSize - Items per bulkCreate call (default 25)
 * @param {number}   delay     - ms between chunks (default 1200)
 */
export async function bulkCreateInChunks(items, bulkFn, onProgress = () => {}, chunkSize = 15, delay = 1500) {
  let created = 0;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await bulkFn(chunk);
    created += chunk.length;
    onProgress(Math.min(created, items.length), items.length);
    if (i + chunkSize < items.length) await new Promise(r => setTimeout(r, delay));
  }
}