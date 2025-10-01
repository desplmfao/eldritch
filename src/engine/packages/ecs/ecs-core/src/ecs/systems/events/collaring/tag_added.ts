/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/ecs/systems/events/collaring/tag_added.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';
import { shallow_clone } from '@eldritch-engine/utils/std/object';

import type { IWorld } from '@self/types/world';
import { WorldEventHandler } from '@self/types/event_handler';
import type { EventArgs } from '@self/types/event';
import type { Res } from '@self/types/markers';

import { ComponentTag } from '@self/ecs/components/collaring/tag';
import { ComponentCollar } from '@self/ecs/components/collaring/collar';

import {
   ResourceComponentUpdates,
   ResourceComponentLastWriteTick,
   ResourceWorldTick
} from '@self/ecs/resources/core';

export class EventOnTagAdded extends WorldEventHandler<'component_added'> {
   async update(
      args: EventArgs['component_added'],
      //
      world: IWorld,
      //
      component_updates: Res<ResourceComponentUpdates>,
      component_last_write_tick: Res<ResourceComponentLastWriteTick>,
      //
      world_tick: Res<ResourceWorldTick>
   ): Promise<void> {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      const [entity_id, added_component] = args;

      if (!(added_component instanceof ComponentTag)) {
         return;
      }

      const collar = world.component_get(entity_id, ComponentCollar);

      if (!collar) {
         return;
      }

      const tag_name = added_component.constructor.name;

      if (collar.associated_tag_names.includes(tag_name)) {
         logger.trace(`entity '${entity_id}': tag '${tag_name}' is already on ${ComponentCollar.name}. no update needed`);

         return;
      }

      logger.trace(`entity '${entity_id}': adding tag '${tag_name}' to collar`);

      collar.associated_tag_names.push(tag_name);
      collar.associated_tag_names.sort();

      const collar_updates_map = component_updates.data.get(ComponentCollar.name);

      if (collar_updates_map) {
         const cloned_collar = shallow_clone(collar);

         collar_updates_map.set(entity_id, cloned_collar);

         component_last_write_tick.data.set(ComponentCollar.name, world_tick.data);
      } else {
         logger.warn(`entity '${entity_id}': ${ComponentCollar.name} was modified by adding a tag, but its update tracking map was not found`);
      }
   }
}