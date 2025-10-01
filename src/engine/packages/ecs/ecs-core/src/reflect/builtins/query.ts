/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/reflect/builtins/query.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@self/types/world';
import type { Injection } from '@self/types/reflection';

import type { Component, ComponentConstructor } from '@self/types/component';
import type { EntityId } from '@self/types/entity';

export type InjectionQuery<CC extends Component[]> = [
   entity_id: EntityId,
   components: {
      [K in keyof CC]: CC[K];
   }
][];

export const injection_type = 'ecs:inject:query';

/** parameter decorator input */
export interface InjectionQueryInput extends Injection {
   injection_type: typeof injection_type;
   components: ComponentConstructor[];
   options: {
      with?: ComponentConstructor[];
      without?: ComponentConstructor[];
   };
}

/** @internal */
export async function inject_query(
   world: IWorld,
   injection: InjectionQueryInput
): Promise<InjectionQuery<Component[]>> {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const component_names_to_query = injection.components.map((c) => c.name);
   const with_names_to_query = injection.options.with?.map((c) => c.name);
   const without_names_to_query = injection.options.without?.map((c) => c.name);

   /// #if LOGGER_HAS_TRACE
   const debug_component_names = component_names_to_query.join(', ');
   const debug_with_names = with_names_to_query?.join(', ');
   const debug_without_names = without_names_to_query?.join(', ');

   logger.trace(`injecting entities with components: [${debug_component_names}]`
      + (debug_with_names ? ` with [${debug_with_names}]` : '')
      + (debug_without_names ? ` without [${debug_without_names}]` : '')
   );
   /// #endif

   const results_array: InjectionQuery<Component[]> = [];
   const view_iterator = world.component_view(
      component_names_to_query,
      {
         with: with_names_to_query,
         without: without_names_to_query
      }
   );

   /// #if LOGGER_HAS_TRACE
   let iteration_count = 0;

   logger.trace(`starting 'for await...of' loop over view iterator...`);
   /// #endif

   try {
      for await (const result_tuple of view_iterator) {
         /// #if LOGGER_HAS_TRACE
         iteration_count++;

         logger.trace(`iteration ${iteration_count}: received tuple for entity_id ${result_tuple[0]}`);
         /// #endif

         results_array.push(result_tuple);
      }
   } catch (e) {
      {
         const message = `error occurred during 'for await...of' loop in injector\n${e.message}`;

         logger.critical(message);
         throw new Error(message, { cause: e });
      }
   }

   /// #if LOGGER_HAS_TRACE
   logger.trace(`'for await...of' loop finished. total iterations: ${iteration_count}`);

   logger.trace(`view async iterator yielded ${results_array.length} entities (final array size)`);
   /// #endif

   return results_array;
}