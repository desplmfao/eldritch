/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/types/world_storage_backend.ts
 */

import type { IWorld } from '@self/types/world';
import type { EntityId, EntitySpawnDefinition } from '@self/types/entity'
import type { Component, ComponentConstructor, ComponentDependencies, ComponentDefinition } from '@self/types/component';

export interface IWorldStorageBackend {
   entity_spawn_defer(definition: EntitySpawnDefinition): void;

   entity_spawn_direct(
      definition: EntitySpawnDefinition,
      parent_id?: EntityId
   ): Promise<EntityId>;

   entity_create_direct(): Promise<EntityId>;

   entity_delete_defer(
      entity: EntityId
   ): void;

   entity_delete_multiple_direct(
      entities_to_delete: EntityId[]
   ): Promise<Map<EntityId, boolean>>;

   entity_delete_direct(
      entity_id: EntityId,
      visited_during_delete?: Set<EntityId>
   ): Promise<boolean>;

   entity_find_direct(
      component_names: string[]
   ): EntityId | undefined;

   entity_find_multiple_direct(
      component_names: string[]
   ): Set<EntityId>;

   entity_is_alive(
      entity_id: EntityId
   ): boolean;

   entity_parent_get(
      child_id: EntityId
   ): EntityId | undefined;

   entity_children_get(
      parent_id: EntityId
   ): EntityId[];

   entity_parent_set_direct(
      child_id: EntityId,
      parent_id?: EntityId
   ): Promise<boolean>;

   entity_view(
      options?: {
         with?: string[];
         without?: string[];
      }
   ): AsyncIterableIterator<EntityId>;

   //
   //

   component_has(
      entity_id: EntityId,
      component_name: string
   ): boolean;

   component_has_multiple(
      entity_id: EntityId,
      component_names: string[]
   ): boolean[];

   component_get<C extends Component>(
      entity_id: EntityId,
      component_name: string
   ): C | undefined;

   component_get_multiple<CC extends Component[]>(
      entity_id: EntityId,
      component_names: string[]
   ): {
         [K in keyof CC]: CC[K] | undefined
      };

   component_add_multiple_defer(
      entity: EntityId,
      component_definitions: ComponentDefinition[]
   ): void;

   component_add_multiple_direct(
      entity: EntityId,
      component_definitions: ComponentDefinition[]
   ): Promise<boolean>;

   component_remove_multiple_defer(
      entity: EntityId,
      names: string[]
   ): void;

   component_remove_multiple_direct(
      entity: EntityId,
      component_names_to_remove: string[],
   ): Promise<boolean>;

   component_validate_dependencies(
      final_names: Set<string>,
      dependencies?: ComponentDependencies,
      entity_id?: EntityId
   ): void;

   component_is_registered(
      name: string
   ): boolean;

   component_get_all<CC extends ComponentConstructor[]>(
      entity_id: EntityId
   ): {
         [K in keyof CC]: InstanceType<CC[K]> | undefined
      }

   component_view<CC extends ComponentConstructor[]>(
      component_names: string[],
      options?: {
         with?: string[];
         without?: string[];
      }
   ): AsyncIterableIterator<
      [
         EntityId,
         {
            [K in keyof CC]: InstanceType<CC[K]>;
         }
      ]
   >;

   //
   //

   initialize?(
      world: IWorld
   ): Promise<void> | void;

   cleanup?(): Promise<void> | void;
}