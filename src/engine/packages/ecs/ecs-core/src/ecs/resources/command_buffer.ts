/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/ecs/resources/command_buffer.ts
 */

// this is per worker and main thread - there still needs to be a guerrero version for temporary store to throw into the main thread later

import type { EntityId, EntitySpawnDefinition } from '@self/types/entity';
import type { ComponentDefinition } from '@self/types/component';
import { Resource } from '@self/types/resource';

export class ResourceCommandBuffer extends Resource {
   spawn_definitions: EntitySpawnDefinition[] = [];

   delete_entity_commands: Set<EntityId> = new Set();

   add_component_commands: Map<EntityId, ComponentDefinition[]> = new Map();
   remove_component_commands: Map<EntityId, Set<string>> = new Map();

   clear(): void {
      this.spawn_definitions = [];

      this.delete_entity_commands.clear();

      this.add_component_commands.clear();
      this.remove_component_commands.clear();
   }
}