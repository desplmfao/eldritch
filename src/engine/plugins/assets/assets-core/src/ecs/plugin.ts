/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/assets/assets-core/src/ecs/plugin.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';

import { Plugin } from '@eldritch-engine/ecs-core/types/plugin';
import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';

import { ResourceAssetServer } from '@self/ecs/resources/asset_server';
import { SystemProcessAssetLoads } from '@self/ecs/systems/process_asset_loads';

export class PluginAssetsCore extends Plugin {
   dependencies = [];

   async build(world: IWorld) {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      if (!world.storage.has(ResourceAssetServer)) {
         world.storage.set(ResourceAssetServer, new ResourceAssetServer());

         logger.trace(`added ${ResourceAssetServer.name}`);
      }

      await this.scheduler.system_add_multiple([
         [Schedule.Update, new SystemProcessAssetLoads()]
      ]);

      return true;
   }
}