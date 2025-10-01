/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/core/core-3d/src/ecs/plugin.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import { Plugin } from '@eldritch-engine/ecs-core/types/plugin';
import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';

import { SystemUpdateWorldTransforms } from '@self/ecs/systems/update_world_transforms';

export class PluginCore3D extends Plugin {
   dependencies = [];

   async build(): Promise<boolean> {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      logger.trace(`building ${PluginCore3D.name}`);

      await this.scheduler.system_add_multiple([
         [Schedule.FixedUpdate, new SystemUpdateWorldTransforms()],
      ]);

      logger.trace(`added ${SystemUpdateWorldTransforms.name}`);

      return true;
   }
}