/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/systems/events/system_command_linker.ts
 */

import { WorldEventHandler } from '@eldritch-engine/ecs-core/types/event_handler';
import type { EventArgs } from '@eldritch-engine/ecs-core/types/event';
import type { Res } from '@eldritch-engine/ecs-core/types/markers';
import { entity_id_none } from '@eldritch-engine/ecs-core/types/entity';

import { ComponentCompiledCommand } from '@self/ecs/components/runtime/compiled_command';

import { ResourceSystemCommandRegistry } from '@self/ecs/resources/system_command_registry';

export class EventSystemCommandLinker extends WorldEventHandler<'component_added' | 'component_removed'> {
   async update(
      args: EventArgs['component_added'] | EventArgs['component_removed'],
      //
      registry: Res<ResourceSystemCommandRegistry>
   ) {
      const [entity_id, component, context] = args;

      if (!(component instanceof ComponentCompiledCommand)) {
         return;
      }

      const affected_systems = registry.get_systems_for_path(component.full_path);

      if (
         !affected_systems
         || affected_systems.size === 0
      ) {
         return;
      }

      const is_remove_event = context
         && 'is_overwrite' in context;

      if (is_remove_event) {
         for (const system of affected_systems) {
            if (system.target_command_id === entity_id) {
               system.$update_target_id(entity_id_none);
            }
         }
      } else {
         for (const system of affected_systems) {
            system.$update_target_id(entity_id);
         }
      }
   }
}