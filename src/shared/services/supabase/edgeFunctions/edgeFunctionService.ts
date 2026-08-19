import type { FunctionInvokeOptions } from '@supabase/supabase-js';

import { getSupabaseClient } from '../client';

export function invokeConfirmedEdgeFunction<TResponse>(
  functionName: string,
  options?: FunctionInvokeOptions,
) {
  return getSupabaseClient().functions.invoke<TResponse>(functionName, options);
}
