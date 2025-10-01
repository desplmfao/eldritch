/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/observer.ts
 */


import { get_metadata } from '@eldritch-engine/reflect/index';
import { default_logger } from '@eldritch-engine/logger/logger';

import type { World } from '@self/world';

import { number_iterator } from '@self/entity';

import type { Event, EventArgs } from '@self/types/event';
import type { WorldEventHandler } from '@self/types/event_handler';

import { ResourceReflectionMap } from '@self/ecs/resources/reflection';

import { METHOD_METADATA_KEY, resolve_and_execute } from '@self/reflect/index';

export class Observer<
   E extends Event = Event,
   EA extends EventArgs = EventArgs,
   EH extends WorldEventHandler<E> = WorldEventHandler<E>
> {
   next_index = number_iterator();

   observers: Map<
      E,
      {
         index: number;
         handler: EH;
      }[]
   > = new Map();

   z$_resource_world: World;
   z$_resource_reflection_map: ResourceReflectionMap;

   constructor(
      world: World
   ) {
      this.z$_resource_world = world;
      this.z$_resource_reflection_map = world.storage.get(ResourceReflectionMap)!;
   }

   async subscribe<Ev extends E>(
      event: Ev,
      handler_instance: WorldEventHandler<Ev>
   ): Promise<number> {
      if (!this.observers.has(event)) {
         this.observers.set(event, []);
      }

      if (handler_instance.initialize) {
         let result: boolean | void = true;

         if (get_metadata(METHOD_METADATA_KEY, handler_instance, 'initialize')) {
            // @ts-expect-error - ???
            result = await resolve_and_execute(this.z$_resource_world, this.z$_resource_reflection_map, handler_instance, 'initialize');
         } else {
            result = await handler_instance.initialize(this.z$_resource_world);
         }

         if (result === false) {
            const logger = default_logger.get_namespaced_logger('<namespace>');

            {
               const message = `event handler '${handler_instance.constructor.name}' for event '${event}' returned false on initialize`;

               logger.critical(message);
               throw new Error(message);
            }
         }
      }

      const index: number = this.next_index.next().value;
      const event_observers = this.observers.get(event)!;

      event_observers.push({
         index: index,
         handler: handler_instance as EH
      });

      return index;
   }

   async unsubscribe<Ev extends E>(
      event: Ev,
      index: number
   ): Promise<void> {
      const callbacks = this.observers.get(event);

      if (callbacks) {
         const callback_to_remove = callbacks.find((cb) => cb.index === index);

         if (callback_to_remove?.handler.cleanup) {
            const handler = callback_to_remove.handler;

            if (get_metadata(METHOD_METADATA_KEY, handler, 'cleanup')) {
               await resolve_and_execute(this.z$_resource_world, this.z$_resource_reflection_map, handler, 'cleanup', [this.z$_resource_world]);
            } else {
               await handler.cleanup?.(this.z$_resource_world);
            }
         }

         this.observers.set(event, callbacks.filter((cb) => cb.index !== index));
      }
   }

   async notify<Ev extends E>(event: Ev, ...args: EA[Ev]): Promise<void> {
      const handlers_to_notify = this.observers.get(event);

      if (handlers_to_notify) {
         for (const { handler } of handlers_to_notify) {
            if (handler.run_criteria) {
               const should_run = get_metadata(METHOD_METADATA_KEY, handler, 'run_criteria')
                  ? await resolve_and_execute(this.z$_resource_world, this.z$_resource_reflection_map, handler, 'run_criteria', [args, this.z$_resource_world])
                  : await handler.run_criteria(args, this.z$_resource_world);

               if (!should_run) {
                  continue;
               }
            }

            if (get_metadata(METHOD_METADATA_KEY, handler, 'update')) {
               await resolve_and_execute(this.z$_resource_world, this.z$_resource_reflection_map, handler, 'update', [args, this.z$_resource_world]);
            } else {
               await handler.update(args, this.z$_resource_world);
            }
         }
      }
   }

   async clear() {
      for (const handlers of this.observers.values()) {
         for (const { handler } of handlers) {
            if (handler.cleanup) {
               if (get_metadata(METHOD_METADATA_KEY, handler, 'cleanup')) {
                  await resolve_and_execute(this.z$_resource_world, this.z$_resource_reflection_map, handler, 'cleanup', [this.z$_resource_world]);
               } else {
                  await handler.cleanup(this.z$_resource_world);
               }
            }
         }
      }

      this.observers.clear();
   }
}