/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-tests/src/parts/observer.ts
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';

import type { IWorldStorageBackend } from '@eldritch-engine/ecs-core/types/world_storage_backend';
import { WorldEventHandler } from '@eldritch-engine/ecs-core/types/event_handler';

class EntityCreatedHandler extends WorldEventHandler<'entity_created'> {
   update = mock(async (args) => { });
}

class EntityDeletedHandler extends WorldEventHandler<'entity_deleted'> {
   update = mock(async (args) => { });
}

class FullLifecycleHandler extends WorldEventHandler<'entity_created'> {
   override initialize = mock(async (world: World) => true);
   override cleanup = mock(async (world: World) => { });
   override run_criteria = mock(async (args, world: World) => true);

   update = mock(async (args, world: World) => { });
}

export async function make_test(
   storage_backend: IWorldStorageBackend
) {
   describe('observer (event system)', () => {
      let world: World;

      let created_handler: EntityCreatedHandler;
      let deleted_handler: EntityDeletedHandler;

      beforeEach(() => {
         world = new World({
            storage_backend,
            logger_options: {
               log_level: 2
            }
         });

         created_handler = new EntityCreatedHandler();
         deleted_handler = new EntityDeletedHandler();
      });

      it('should subscribe a handler and notify it when an event occurs', async () => {
         await world.subscribe('entity_created', created_handler);

         const entity_id = await world.entity_create_direct();

         expect(created_handler.update).toHaveBeenCalledTimes(1);
         expect(created_handler.update).toHaveBeenCalledWith([entity_id], world);
      });

      it('should allow multiple handlers for the same event', async () => {
         const another_created_handler = new EntityCreatedHandler();

         await world.subscribe('entity_created', created_handler);
         await world.subscribe('entity_created', another_created_handler);

         await world.entity_create_direct();

         expect(created_handler.update).toHaveBeenCalledTimes(1);
         expect(another_created_handler.update).toHaveBeenCalledTimes(1);
      });

      it('should not notify a handler after it has been unsubscribed', async () => {
         const sub_index = await world.subscribe('entity_created', created_handler);

         await world.entity_create_direct();
         expect(created_handler.update).toHaveBeenCalledTimes(1);

         await world.unsubscribe('entity_created', sub_index);

         await world.entity_create_direct();
         expect(created_handler.update).toHaveBeenCalledTimes(1);
      });

      it('should do nothing when notifying an event with no subscribers', async () => {
         await world.notify('entity_deleted', 123);

         expect(deleted_handler.update).not.toHaveBeenCalled();
      });

      describe('lifecycle', () => {
         let lifecycle_handler: FullLifecycleHandler;

         beforeEach(() => {
            lifecycle_handler = new FullLifecycleHandler();
         });

         it('should call initialize() on subscribe', async () => {
            await world.subscribe('entity_created', lifecycle_handler);

            expect(lifecycle_handler.initialize).toHaveBeenCalledTimes(1);
            expect(lifecycle_handler.initialize).toHaveBeenCalledWith(world);
         });

         it('should throw if initialize() returns false', async () => {
            lifecycle_handler.initialize.mockResolvedValue(false);

            const subscribe_promise = world.subscribe('entity_created', lifecycle_handler);
            expect(subscribe_promise).rejects.toThrow(/returned false on initialize/);
         });

         it('should call cleanup() on unsubscribe', async () => {
            const sub_index = await world.subscribe('entity_created', lifecycle_handler);

            await world.unsubscribe('entity_created', sub_index);

            expect(lifecycle_handler.cleanup).toHaveBeenCalledTimes(1);
            expect(lifecycle_handler.cleanup).toHaveBeenCalledWith(world);
         });

         it('should call cleanup() on world.cleanup() for all handlers', async () => {
            const another_handler = new FullLifecycleHandler();

            await world.subscribe('entity_created', lifecycle_handler);
            await world.subscribe('entity_deleted', another_handler);

            await world.cleanup();

            expect(lifecycle_handler.cleanup).toHaveBeenCalledTimes(1);
            expect(another_handler.cleanup).toHaveBeenCalledTimes(1);
         });

         it('should call update() if run_criteria() returns true', async () => {
            lifecycle_handler.run_criteria.mockResolvedValue(true);

            await world.subscribe('entity_created', lifecycle_handler);
            await world.entity_create_direct();

            expect(lifecycle_handler.run_criteria).toHaveBeenCalledTimes(1);
            expect(lifecycle_handler.update).toHaveBeenCalledTimes(1);
         });

         it('should NOT call update() if run_criteria() returns false', async () => {
            lifecycle_handler.run_criteria.mockResolvedValue(false);

            await world.subscribe('entity_created', lifecycle_handler);
            await world.entity_create_direct();

            expect(lifecycle_handler.run_criteria).toHaveBeenCalledTimes(1);
            expect(lifecycle_handler.update).not.toHaveBeenCalled();
         });
      });
   });
}