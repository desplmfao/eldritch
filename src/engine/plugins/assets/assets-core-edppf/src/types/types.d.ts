/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/assets/assets-core-edppf/src/types/types.d.ts
 */

import type { ResourceCommandBuffer as CoreResourceCommandBuffer } from '@eldritch-engine/ecs-core/ecs/resources/command_buffer';

import type { PrefabSpawnCommand } from '@self/types/types';

export interface IWorldMixin {
   /**
    * defers spawning an entity from a prefab asset
    * 
    * the prefab will be instantiated at the end of the `FixedFlush` schedule
    *
    * @param command A `PrefabSpawnCommand` object describing the prefab handle and optional parent
    */
   prefab_spawn_defer(command: PrefabSpawnCommand): void;

   /**
    * spawns an entity from a prefab asset immediately
    *
    * @param command a `PrefabSpawnCommand` object
    */
   prefab_spawn_direct(command: PrefabSpawnCommand): Promise<void>;
}

declare module '@eldritch-engine/ecs-core/types/world' {
   interface IWorld extends IWorldMixin { }
}

declare module '@eldritch-engine/ecs-core/world' {
   interface World extends IWorldMixin { }
}

declare module '@eldritch-engine/ecs-core/ecs/resources/command_buffer' {
   interface ResourceCommandBuffer extends CoreResourceCommandBuffer {
      prefab_spawn_commands: PrefabSpawnCommand[];
   }
}