import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { ApiResult } from "../../../../shared/contracts.js";
import type { CoordinatorApi } from "../../../api.js";

const LISTS_KEY = ["queued-task-lists"];
const TODOS_KEY = ["queued-tasks"];
async function unwrap<T>(result: Promise<ApiResult<T>>) {
  const value = await result;
  if (value.error) throw new Error(value.error.message);
  return value.data;
}
export function useTaskLists(api: CoordinatorApi) {
  return useSuspenseQuery({ queryKey: LISTS_KEY, queryFn: () => unwrap(api.listQueuedTaskLists()) });
}
export function useListTodos(api: CoordinatorApi, listId: string) {
  return useSuspenseQuery({ queryKey: [...TODOS_KEY, listId], queryFn: () => unwrap(api.listQueuedTasks(listId)) });
}
export function useQueueCommand<T = unknown>() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (operation: () => Promise<ApiResult<T>>) => unwrap(operation()),
    onSuccess: async () => {
      await Promise.all([client.invalidateQueries({ queryKey: LISTS_KEY }), client.invalidateQueries({ queryKey: TODOS_KEY })]);
    },
  });
}
