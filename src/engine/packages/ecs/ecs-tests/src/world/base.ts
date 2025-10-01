/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-tests/src/world/base.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';
import { Storage } from '@eldritch-engine/ecs-core/storage';

import type { IWorldStorageBackend } from '@eldritch-engine/ecs-core/types/world_storage_backend';

import { ResourceLoopControl } from '@eldritch-engine/ecs-core/ecs/resources/loop_control';
import { ResourceCommandBuffer } from '@eldritch-engine/ecs-core/ecs/resources/command_buffer';

import {
   ResourceEntitiesDeleted,
   ResourceComponentEntities,
   ResourceComponentUpdates,
   ResourceWorldTick,
} from '@eldritch-engine/ecs-core/ecs/resources/core';

export async function make_test(
   storage_backend: IWorldStorageBackend
) {
   describe('base initialization', () => {
      let world: World;

      beforeEach(() => {
         world = new World({
            storage_backend
         });
      });

      it('should create a new world instance', () => {
         expect(world).toBeInstanceOf(World);
      });

      it('should have a storage instance', () => {
         expect(world.storage).toBeInstanceOf(Storage);
      });

      it('should not be initialized by default', () => {
         expect(world.initialized).toBe(false);
      });

      it('should have an id generator', () => {
         expect(world.id_generator).toBeDefined();
         expect(world.id_generator.next().value).toBe(1);
      });

      it('should initialize default core resources', () => {
         expect(world.storage.get(ResourceEntitiesDeleted)).toBeInstanceOf(ResourceEntitiesDeleted);
         expect(world.storage.get(ResourceComponentEntities)).toBeInstanceOf(ResourceComponentEntities);
         expect(world.storage.get(ResourceComponentUpdates)).toBeInstanceOf(ResourceComponentUpdates);
         expect(world.storage.get(ResourceWorldTick)).toBeInstanceOf(ResourceWorldTick);
         expect(world.storage.get(ResourceLoopControl)).toBeInstanceOf(ResourceLoopControl);
      });

      it('should initialize a command buffer', () => {
         expect(world.storage.get(ResourceCommandBuffer)).toBeInstanceOf(ResourceCommandBuffer);
      });
   });
}