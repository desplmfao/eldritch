/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/systems/executed_commands_cleanup.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';
import { System } from '@eldritch-engine/ecs-core/types/system';
import type { Query } from '@eldritch-engine/ecs-core/types/markers';

import { ComponentCommandInvocation } from '@self/ecs/components/runtime/command_invocation';
import { ComponentCurrentlyExecuted } from '@self/ecs/components/markers/currently_executed';

export class SystemExecutedCommandsCleanup extends System {
   override order = 1_000_000;

   async update(
      world: IWorld,
      //
      invocation_entities: Query<[ComponentCommandInvocation]>
   ) {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      for (const [transient_entity_id, [invocation]] of invocation_entities) {
         const target_id = invocation.target_command_entity;

         if (
            world.entity_is_alive(target_id)
            && world.component_has(target_id, ComponentCurrentlyExecuted.name)
         ) {
            logger.trace(`cleaning up execution marker from command entity '${target_id}'`);

            await world.component_remove_multiple_direct(
               target_id,
               [
                  ComponentCurrentlyExecuted.name
               ]
            );
         }

         await world.entity_delete_direct(transient_entity_id);
      }
   }
}