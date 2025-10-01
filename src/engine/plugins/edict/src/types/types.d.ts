/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/types/types.d.ts
 */

import type { EntitySpawnDefinition } from '@eldritch-engine/ecs-core/types/entity';
import type { Component } from '@eldritch-engine/ecs-core/types/component';

import type { ResourceCommandBuffer as CoreResourceCommandBuffer } from '@eldritch-engine/ecs-core/ecs/resources/command_buffer';

//
//

/**
 * adds edict specific methods to the world interface
 * 
 * @internal
 */
export interface IWorldMixin {
   /**
    * defers the creation of a hierarchical command graph from a single definition object
    * 
    * the entities will be spawned at the end of the `FixedFlush` schedule.
    *
    * @param definition a `EntitySpawnDefinition` object describing the root of the command tree and its children recursively
    */
   command_spawn_defer(definition: EntitySpawnDefinition): void;

   /**
    * creates a hierarchical command graph from a single definition object immediately, bypassing the command buffer
    * 
    * @param definition a recursive `EntitySpawnDefinition` object describing the entity and its children
    * 
    * @returns the `EntityId` of the root command entity spawned from the definition
    */
   command_spawn_direct(definition: EntitySpawnDefinition): Promise<EntityId>;
}

declare module '@eldritch-engine/ecs-core/types/world' {
   interface IWorld extends IWorldMixin { }
}

declare module '@eldritch-engine/ecs-core/world' {
   interface World extends IWorldMixin { }
}

declare module '@eldritch-engine/ecs-core/ecs/resources/command_buffer' {
   interface ResourceCommandBuffer extends CoreResourceCommandBuffer {
      command_spawn_commands: EntitySpawnDefinition[];
   }
}