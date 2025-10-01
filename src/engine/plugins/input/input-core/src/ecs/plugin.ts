/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/input/input-core/src/ecs/plugin.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';
import { Plugin } from '@eldritch-engine/ecs-core/types/plugin';
import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';

import { ResourceInputMap } from '@self/ecs/resources/input_map';
import { ResourceActionState } from '@self/ecs/resources/action_state';
import { ResourceInputAdapterHandle } from '@self/ecs/resources/input_adapter_handle';
import { ResourceInputTimingConfig } from '@self/ecs/resources/input_timing_config';

import { SystemProcessInputEvents } from '@self/ecs/systems/process_input_events';

export class PluginInputCore extends Plugin {
   async build(world: IWorld) {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      logger.trace('building core input plugin');

      if (!world.storage.has(ResourceInputAdapterHandle)) {
         world.storage.set(ResourceInputAdapterHandle, new ResourceInputAdapterHandle());

         logger.trace(`added ${ResourceInputAdapterHandle.name}`);
      }

      if (!world.storage.has(ResourceInputMap)) {
         world.storage.set(ResourceInputMap, new ResourceInputMap());

         logger.trace(`added ${ResourceInputMap.name}`);
      }

      if (!world.storage.has(ResourceActionState)) {
         world.storage.set(ResourceActionState, new ResourceActionState());

         logger.trace(`added ${ResourceActionState.name}`);
      }

      if (!world.storage.has(ResourceInputTimingConfig)) {
         world.storage.set(ResourceInputTimingConfig, new ResourceInputTimingConfig());

         logger.trace(`added ${ResourceInputTimingConfig.name}`);
      }

      await this.scheduler.system_add_multiple([
         [Schedule.First, new SystemProcessInputEvents()]
      ]);

      logger.trace(`added ${SystemProcessInputEvents.name}`);

      return true;
   }
}