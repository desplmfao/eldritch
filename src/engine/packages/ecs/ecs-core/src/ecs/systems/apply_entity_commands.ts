/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/ecs/systems/apply_entity_commands.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@self/types/world';
import { System } from '@self/types/system';
import type { Res } from '@self/types/markers';

import { ResourceCommandBuffer } from '@self/ecs/resources/command_buffer';

export class SystemApplyEntityCommands extends System {
   override order = 10;

   async update(
      world: IWorld,
      //
      cmd_buffer: Res<ResourceCommandBuffer>
   ): Promise<void> {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      const has_commands =
         cmd_buffer.spawn_definitions.length > 0
         || cmd_buffer.delete_entity_commands.size > 0
         || cmd_buffer.add_component_commands.size > 0
         || cmd_buffer.remove_component_commands.size > 0;

      if (!has_commands) {
         return;
      }

      logger.trace('--- START ---');
      logger.trace(`buffer state: spawns: ${cmd_buffer.spawn_definitions.length}, deletes: ${cmd_buffer.delete_entity_commands.size}, adds: ${cmd_buffer.add_component_commands.size}, removes: ${cmd_buffer.remove_component_commands.size}`);

      if (cmd_buffer.spawn_definitions.length > 0) {
         logger.trace(`processing ${cmd_buffer.spawn_definitions.length} spawn definitions...`);

         const spawns_to_process = [...cmd_buffer.spawn_definitions];
         cmd_buffer.spawn_definitions = [];

         for (const spawn_definition of spawns_to_process) {
            try {
               await world.entity_spawn_direct(spawn_definition);
            } catch (e) {
               {
                  const message = `error processing recursive spawn definition\n${e.message}`;

                  logger.critical(message);
                  throw new Error(message, { cause: e });
               }
            }
         }
      }

      const adds_to_process = new Map(cmd_buffer.add_component_commands);
      const removes_to_process = new Map(cmd_buffer.remove_component_commands);
      const deletes_to_process = new Set(cmd_buffer.delete_entity_commands);

      cmd_buffer.add_component_commands.clear();
      cmd_buffer.remove_component_commands.clear();
      cmd_buffer.delete_entity_commands.clear();

      for (const [entity_id, component_definitions_to_add] of adds_to_process.entries()) {
         /// #if LOGGER_HAS_TRACE
         if (deletes_to_process.has(entity_id)) {
            logger.trace(`entity '${entity_id}': skipping add components, entity pending delete in this batch`);
         } else if (!world.entity_is_alive(entity_id)) {
            logger.trace(`entity '${entity_id}': skipping add components, entity is not alive (was it deleted previously or spawn failed?)`);
         }

         else
         /// #endif
         {
            logger.trace(`entity '${entity_id}': applying add components [${component_definitions_to_add.map((c) => c[0].name).join(', ')}]...`);

            try {
               await world.component_add_multiple_direct(entity_id, component_definitions_to_add);
            } catch (e) {
               {
                  const message = `   -> error applying add components for entity ${entity_id}\n${e.message}`;

                  logger.critical(message);
                  throw new Error(message, { cause: e });
               }
            }
         }
      }

      for (const [entity_id, ctors_to_remove] of removes_to_process.entries()) {
         /// #if LOGGER_HAS_TRACE
         if (deletes_to_process.has(entity_id)) {
            logger.trace(`entity '${entity_id}': skipping remove components, entity pending delete in this batch`);
         } else if (!world.entity_is_alive(entity_id)) {
            logger.trace(`entity '${entity_id}': skipping remove components, entity is not alive`);
         }

         else
         /// #endif
         {
            logger.trace(`entity '${entity_id}': applying remove components [${[...ctors_to_remove].join(', ')}]...`);

            try {
               await world.component_remove_multiple_direct(entity_id, [...ctors_to_remove]);
            } catch (e) {
               {
                  const message = `   -> error applying remove components for entity ${entity_id}\n${e.message}`;

                  logger.critical(message);
                  throw new Error(message, { cause: e });
               }
            }
         }
      }

      if (deletes_to_process.size > 0) {
         logger.trace(`deleting ${deletes_to_process.size} entities: [${[...deletes_to_process].join(', ')}]...`);

         try {
            await world.entity_delete_multiple_direct([...deletes_to_process]);
         } catch (e) {
            {
               const message = `   -> error applying delete entities command\n${e.message}`;

               logger.critical(message);
               throw new Error(message, { cause: e });
            }
         }
      }

      logger.trace('--- END ---');
   }
}