/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/systems/process_recompile_queue.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';
import { System } from '@eldritch-engine/ecs-core/types/system';
import type { Res } from '@eldritch-engine/ecs-core/types/markers';

import { ResourceRecompileQueue } from '@self/ecs/resources/recompile_queue';

import { recompile_descendant_leaves } from '@self/ecs/compile_command_helper';

export class SystemProcessRecompileQueue extends System {
   async update(
      world: IWorld,
      //
      recompile_queue: Res<ResourceRecompileQueue>
   ) {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      if (recompile_queue.entities.size === 0) {
         return;
      }

      const entities_to_process = new Set(recompile_queue.entities);
      recompile_queue.entities.clear();

      logger.trace(`processing ${ResourceRecompileQueue.name} with ${entities_to_process.size} root entities...`);

      const recompile_promises: Promise<void>[] = [];

      for (const entity_id of entities_to_process) {
         if (world.entity_is_alive(entity_id)) {
            recompile_promises.push(recompile_descendant_leaves(
               world,
               //
               entity_id
            ));
         }
      }

      await Promise.all(recompile_promises);

      logger.trace(`${ResourceRecompileQueue.name} processed`);
   }
}