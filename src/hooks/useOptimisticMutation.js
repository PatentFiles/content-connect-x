import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

/**
 * useOptimisticMutation
 * ─────────────────────
 * A lightweight optimistic-UI helper built on top of TanStack Query's cache.
 *
 * Usage:
 *   const { mutate, isPending } = useOptimisticMutation({
 *     queryKey: ['messages', conversationId],
 *     // Return the new cache value before the server responds
 *     optimisticUpdate: (oldData, variables) => [...(oldData ?? []), variables.newMessage],
 *     // The actual async operation
 *     mutationFn: (variables) => base44.entities.Message.create(variables.newMessage),
 *     // (optional) called after success — merge server response into cache
 *     onSuccess: (serverData, variables, queryClient) => {
 *       queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
 *     },
 *   });
 *
 * How it works:
 *   1. Snapshot current cache value.
 *   2. Apply optimisticUpdate() immediately so the UI responds instantly.
 *   3. Execute mutationFn() in the background.
 *   4. On failure, roll back to the snapshot and re-throw.
 *   5. On success, call the optional onSuccess callback.
 */
export function useOptimisticMutation({
  queryKey,
  optimisticUpdate,
  mutationFn,
  onSuccess,
  onError,
}) {
  const queryClient = useQueryClient();
  const pendingRef = useRef(false);

  const mutate = useCallback(
    async (variables) => {
      if (pendingRef.current) return; // debounce double-taps
      pendingRef.current = true;

      // 1. Cancel any in-flight fetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey });

      // 2. Snapshot current value for rollback
      const previousData = queryClient.getQueryData(queryKey);

      // 3. Apply optimistic update
      if (optimisticUpdate) {
        queryClient.setQueryData(queryKey, (old) => optimisticUpdate(old, variables));
      }

      try {
        // 4. Run the real mutation
        const result = await mutationFn(variables);

        // 5. Optional post-success hook (e.g. invalidate / merge)
        if (onSuccess) {
          await onSuccess(result, variables, queryClient);
        }

        return result;
      } catch (error) {
        // 6. Roll back to snapshot
        queryClient.setQueryData(queryKey, previousData);
        if (onError) {
          onError(error, variables, queryClient);
        }
        throw error;
      } finally {
        pendingRef.current = false;
      }
    },
    [queryKey, queryClient, optimisticUpdate, mutationFn, onSuccess, onError]
  );

  return { mutate };
}

/**
 * useOptimisticToggle
 * ───────────────────
 * Specialised helper for toggling a boolean field on a list item.
 *
 * Usage:
 *   const toggle = useOptimisticToggle({
 *     queryKey: ['tasks'],
 *     idField: 'id',
 *     field: 'completed',
 *     mutationFn: (item) => base44.entities.Task.update(item.id, { completed: item.completed }),
 *   });
 *   <button onClick={() => toggle(task)}>Complete</button>
 */
export function useOptimisticToggle({ queryKey, idField = 'id', field, mutationFn }) {
  const { mutate } = useOptimisticMutation({
    queryKey,
    optimisticUpdate: (old, item) =>
      (old ?? []).map((entry) =>
        entry[idField] === item[idField]
          ? { ...entry, [field]: !entry[field] }
          : entry
      ),
    mutationFn,
  });

  return mutate;
}