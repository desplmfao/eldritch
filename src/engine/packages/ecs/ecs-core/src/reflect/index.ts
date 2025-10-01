/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/reflect/index.ts
 */

import { get_injection_metadata } from '@eldritch-engine/reflect/index';

import type { MaybePromise } from '@eldritch-engine/type-utils';

import type { IWorld } from '@self/types/world';
import type { Injection } from '@self/types/reflection';
import { ResourceReflectionMap } from '@self/ecs/resources/reflection';

export const METHOD_METADATA_KEY = 'eldritch:is_di_target';

/** @internal */
export async function resolve_and_execute(
   world: IWorld,
   //
   r_reflection_map: ResourceReflectionMap,
   //
   target_instance: object,
   property_key: string | symbol,
   //
   original_args: unknown[] = []
) {
   const original_method = target_instance[property_key as keyof typeof target_instance] as {
      length: number;
      apply: (target: object, args: unknown[]) => MaybePromise<unknown>
   };

   if (!original_method) {
      throw new Error(`method '${String(property_key)}' not found on target`);
   }

   const injection_map = get_injection_metadata(target_instance, property_key);

   if (injection_map.size === 0) {
      return await original_method.apply(target_instance, original_args);
   }

   const injection_entries = [...injection_map.entries()].sort((a, b) => a[0] - b[0]);

   const resolution_promises = injection_entries.map(([, inj]) => {
      const resolver = r_reflection_map.injection_resolvers.get((inj as Injection).injection_type as string);

      if (!resolver) {
         throw new Error(`no resolver found for injection type: ${String((inj as Injection).injection_type)}`);
      }

      return resolver(world, inj as Injection);
   });

   const resolved_values = await Promise.all(resolution_promises);
   const parameter_count = original_method.length;
   const final_args = new Array(parameter_count);
   const original_args_to_consume = [...original_args];

   for (let i = 0, inj_idx = 0; i < parameter_count; i++) {
      if (injection_entries[inj_idx]?.[0] === i) {
         final_args[i] = resolved_values[inj_idx];

         inj_idx++;
      } else {
         if (original_args_to_consume.length > 0) {
            final_args[i] = original_args_to_consume.shift();
         } else {
            final_args[i] = undefined;
         }
      }
   }

   return await original_method.apply(target_instance, final_args);
}