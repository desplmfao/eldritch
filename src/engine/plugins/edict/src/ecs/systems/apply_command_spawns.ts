/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/systems/apply_command_spawns.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';

import { System } from '@eldritch-engine/ecs-core/types/system';
import type { Res } from '@eldritch-engine/ecs-core/types/markers';

import { ResourceCommandBuffer } from '@eldritch-engine/ecs-core/ecs/resources/command_buffer';

export class SystemApplyCommandSpawns extends System {
   override order = 11;;

   async update(
      world: IWorld,
      //
      cmd_buffer: Res<ResourceCommandBuffer>
   ): Promise<void> {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      if (
         !cmd_buffer.command_spawn_commands
         || cmd_buffer.command_spawn_commands.length === 0
      ) {
         return;
      }

      const commands_to_process = [...cmd_buffer.command_spawn_commands];
      cmd_buffer.command_spawn_commands = [];

      for (const root_definition of commands_to_process) {
         try {
            await world.command_spawn_direct(root_definition);
         } catch (e) {
            {
               const message = `failed to process recursive command spawn definition`; // TODO: make this more descriptive

               logger.critical(message);
               throw new Error(message);
            }
         }
      }
   }
}