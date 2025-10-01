/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/ecs/resources/reflection.ts
 */

// this is also per worker and main thread - its not possible to have these stored in guerrero due to the map value being a javascript function

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@self/types/world';
import type { InjectionResolver } from '@self/types/reflection';
import { Resource } from '@self/types/resource';

export class ResourceReflectionMap extends Resource {
   injection_resolvers: Map<string, InjectionResolver> = new Map();

   /**
    * registers a resolver function for a custom dependency injection decorator
    *
    * @param injection_type a unique string key that your decorator's metadata will use
    * @param resolver the function that will resolve the dependency when the decorator is used
    */
   register_injection_resolver(
      injection_type: string,
      resolver: (world: IWorld, injection: any) => any
   ): void {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      /// #if SAFETY
      if (this.injection_resolvers.has(injection_type)) {
         logger.warn(`overwriting injection resolver for type: '${injection_type}'`);
      }
      /// #endif

      this.injection_resolvers.set(injection_type, resolver);

      logger.trace(`registered injection resolver for type: '${injection_type}'`);
   }
}