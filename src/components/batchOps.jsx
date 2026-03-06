/**
 * Rate-limit-safe sequential deleter.
 * delay=300ms between each operation to avoid 429 errors.
 * cancelRef.current = true stops the loop early.
 */
export async function batchDelete(ids, deleteFn, onProgress, cancelRef, delay = 300) {
  for (let i = 0; i < ids.length; i++) {
    if (cancelRef?.current) break;
    await deleteFn(ids[i]);
    onProgress(i + 1, ids.length);
    if (i < ids.length - 1) await new Promise(r => setTimeout(r, delay));
  }
}

export async function batchUpdate(items, updateFn, onProgress, cancelRef, delay = 300) {
  for (let i = 0; i < items.length; i++) {
    if (cancelRef?.current) break;
    await updateFn(items[i]);
    onProgress(i + 1, items.length);
    if (i < items.length - 1) await new Promise(r => setTimeout(r, delay));
  }
}