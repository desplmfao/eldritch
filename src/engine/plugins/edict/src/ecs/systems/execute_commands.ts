/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/systems/execute_commands.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';
import { System } from '@eldritch-engine/ecs-core/types/system';
import type { Query } from '@eldritch-engine/ecs-core/types/markers';

import { ComponentCommandInvocation } from '@self/ecs/components/runtime/command_invocation';
import { ComponentCurrentlyExecuted } from '@self/ecs/components/markers/currently_executed';

export class SystemExecuteCommands extends System {
   override order = -1;

   async update(
      world: IWorld,
      //
      invocation_entities: Query<[ComponentCommandInvocation]>
   ) {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      for (const [, [invocation]] of invocation_entities) {
         const target_id = invocation.target_command_entity;

         if (world.entity_is_alive(target_id)) {
            logger.trace(`marking command entity '${target_id}' for execution`);

            await world.component_add_multiple_direct(target_id, [[ComponentCurrentlyExecuted, {}]]);
         } else {
            logger.trace(`cannot execute command: target entity '${target_id}' is no longer alive`);
         }
      }
   }
}