/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/assets/assets-core-edppf/src/ecs/plugin.ts
 */

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';

import { Plugin } from '@eldritch-engine/ecs-core/types/plugin';
import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';
import type { Res } from '@eldritch-engine/ecs-core/types/markers';

import { ResourceCommandBuffer } from '@eldritch-engine/ecs-core/ecs/resources/command_buffer';

import { ResourceAssetServer } from '@eldritch-engine/plugin-assets-core/ecs/resources/asset_server';

import { SystemApplyPrefabSpawns } from '@self/ecs/systems/apply_prefab_spawns';

import type { PrefabSpawnCommand } from '@self/types/index';

import { EDPPFLoader } from '@self/loader';

export class PluginAssetsCoreEdppf extends Plugin {
   dependencies = [];

   async build(
      world: IWorld,
      //
      asset_server: Res<ResourceAssetServer>
   ): Promise<boolean> {
      asset_server.add_loader(new EDPPFLoader());

      {
         const r_command_buffer = world.storage.get(ResourceCommandBuffer)!;

         if (!r_command_buffer.prefab_spawn_commands) {
            r_command_buffer.prefab_spawn_commands = [];
         }

         world.prefab_spawn_defer = (command: PrefabSpawnCommand): void => {
            r_command_buffer.prefab_spawn_commands.push(command);
         };

         world.prefab_spawn_direct = async (command: PrefabSpawnCommand): Promise<void> => {
            console.warn('prefab_spawn_direct is not yet implemented');
         };
      }

      await this.scheduler.system_add_multiple([
         [Schedule.FixedFlush, new SystemApplyPrefabSpawns()]
      ]);

      return true;
   }
}