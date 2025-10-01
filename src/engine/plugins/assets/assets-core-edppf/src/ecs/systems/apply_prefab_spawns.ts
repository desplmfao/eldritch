/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/assets/assets-core-edppf/src/ecs/systems/apply_prefab_spawns.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import { System } from '@eldritch-engine/ecs-core/types/system';
import type { Res } from '@eldritch-engine/ecs-core/types/markers';

import { ResourceCommandBuffer } from '@eldritch-engine/ecs-core/ecs/resources/command_buffer';

export class SystemApplyPrefabSpawns extends System {
   override order = -5;

   dependencies = {};

   async update(
      cmd_buffer: Res<ResourceCommandBuffer>
   ): Promise<void> {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      const prefab_commands = cmd_buffer.prefab_spawn_commands;

      if (
         !prefab_commands ||
         prefab_commands.length === 0
      ) {
         return;
      }

      // a real implementation would be more complex:
      // 1. check if the prefab asset is loaded via its handle
      // 2. if loaded, get its EDPPFAsset data
      // 3. create a new root entity
      // 4. iterate the EDPPFAsset.operations, construct EBNP packets, and dispatch them to an in-memory bus
      // 5. another system would then process these packets to build the entity

      logger.trace(`processing ${prefab_commands.length} deferred prefab spawns... (logic not yet implemented)`);

      // for now, we just clear the queue
      prefab_commands.length = 0;
   }
}