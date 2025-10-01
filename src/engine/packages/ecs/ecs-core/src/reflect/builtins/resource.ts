/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/reflect/builtins/resource.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@self/types/world';
import type { Injection } from '@self/types/reflection';

import type { ResourceConstructor } from '@self/types/resource';

export const injection_type = 'ecs:inject:resource';

/** output type */
export type InjectionResource<T = ResourceConstructor> = T;

/** parameter decorator input */
export interface InjectionResourceInput extends Injection {
   injection_type: typeof injection_type;
   //
   resource_ctor: ResourceConstructor;
}

/** @internal */
export function inject_resource(
   world: IWorld,
   //
   injection: InjectionResourceInput
): InjectionResource {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   /// #if LOGGER_HAS_TRACE
   logger.trace(`injecting resource by name: '${injection.resource_ctor.name}'`);
   /// #endif

   const resource = world.storage.get(injection.resource_ctor);

   if (resource == null) {
      {
         const message = `required resource '${injection.resource_ctor.name}' not found in world storage. ensure it was added/initialized correctly`;

         logger.critical(message);
         throw new Error(message);
      }
   }

   /// #if LOGGER_HAS_TRACE
   logger.trace(`found resource for name '${injection.resource_ctor.name}':`, resource?.constructor?.name || resource);
   /// #endif

   return resource;
}
