/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-storage-backend-archetype/src/index.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';
import type { IWorldStorageBackend } from '@eldritch-engine/ecs-core/types/world_storage_backend';

import type { Component, ComponentDependencies, ComponentConstructor, ComponentDefinition } from '@eldritch-engine/ecs-core/types/component';
import type { EntitySpawnDefinition, EntityId } from '@eldritch-engine/ecs-core/types/entity';

import { ResourceCommandBuffer } from '@eldritch-engine/ecs-core/ecs/resources/command_buffer';
import { ResourceLoopControl } from '@eldritch-engine/ecs-core/ecs/resources/loop_control';
import { ResourceRelationshipRegistry } from '@eldritch-engine/ecs-core/ecs/resources/relationship';

import {
   ResourceEntitiesDeleted,
   ResourceComponentEntities,
   ResourceComponentUpdates,
   ResourceComponentLastWriteTick,
   ResourceSystemLastWriteTick,
   ResourceWorldTick,
   ResourceDeltaTimeLogical,
   ResourceDeltaTimeLogicalReal,
   ResourceDeltaTimeRender,
   ResourceDeltaTimeRenderReal
} from '@eldritch-engine/ecs-core/ecs/resources/core';

import { ResourceArchetypeMap } from '@self/ecs/resources/archetype';
import { ResourceQueryCache } from '@self/ecs/resources/query_cache';

import {
   entity_spawn_defer,
   entity_spawn_direct,
   entity_create_direct,
   entity_delete_defer,
   entity_delete_multiple_direct,
   entity_delete_direct,
   entity_find_direct,
   entity_find_multiple_direct,
   entity_is_alive,
   entity_parent_get,
   entity_children_get,
   entity_parent_set_direct,
   entity_view
} from '@self/operations/entity';

import {
   component_add_multiple_defer,
   component_add_multiple_direct,
   component_get,
   component_get_all,
   component_get_multiple,
   component_has,
   component_has_multiple,
   component_is_registered,
   component_remove_multiple_defer,
   component_remove_multiple_direct,
   component_validate_dependencies,
   component_view
} from '@self/operations/component';

import {
   archetype_find_or_create
} from '@self/operations/archetype';

export class WorldStorageBackendArchetype implements IWorldStorageBackend {

   z$_resource_world!: IWorld;
   z$_resource_archetype_map!: ResourceArchetypeMap;
   z$_resource_query_cache!: ResourceQueryCache;
   z$_resource_command_buffer!: ResourceCommandBuffer;
   z$_resource_relationship_registry!: ResourceRelationshipRegistry;
   z$_resource_deleted_entities!: ResourceEntitiesDeleted;
   z$_resource_component_entities!: ResourceComponentEntities;
   z$_resource_component_updates!: ResourceComponentUpdates;
   z$_resource_component_last_write_tick!: ResourceComponentLastWriteTick;
   z$_resource_system_last_write_tick!: ResourceSystemLastWriteTick;
   z$_resource_world_tick!: ResourceWorldTick;
   z$_resource_loop_control!: ResourceLoopControl;
   z$_resource_delta_time_logical!: ResourceDeltaTimeLogical;
   z$_resource_delta_time_logical_real!: ResourceDeltaTimeLogicalReal;
   z$_resource_delta_time_render!: ResourceDeltaTimeRender;
   z$_resource_delta_time_render_real!: ResourceDeltaTimeRenderReal;

   initialize(world: IWorld) {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      this.z$_resource_world = world;

      world.storage.set(ResourceQueryCache, new ResourceQueryCache());
      this.z$_resource_query_cache = world.storage.get(ResourceQueryCache)!;

      world.storage.set(ResourceArchetypeMap, new ResourceArchetypeMap());
      this.z$_resource_archetype_map = world.storage.get(ResourceArchetypeMap)!;

      archetype_find_or_create(
         this.z$_resource_archetype_map,
         // 
         new Set()
      );

      //
      //

      this.z$_resource_loop_control = world.storage.get(ResourceLoopControl)!;
      this.z$_resource_delta_time_logical = world.storage.get(ResourceDeltaTimeLogical)!;
      this.z$_resource_delta_time_logical_real = world.storage.get(ResourceDeltaTimeLogicalReal)!;
      this.z$_resource_delta_time_render = world.storage.get(ResourceDeltaTimeRender)!;
      this.z$_resource_delta_time_render_real = world.storage.get(ResourceDeltaTimeRenderReal)!;
      this.z$_resource_command_buffer = world.storage.get(ResourceCommandBuffer)!;
      this.z$_resource_relationship_registry = world.storage.get(ResourceRelationshipRegistry)!;
      this.z$_resource_deleted_entities = world.storage.get(ResourceEntitiesDeleted)!;
      this.z$_resource_component_entities = world.storage.get(ResourceComponentEntities)!;
      this.z$_resource_component_updates = world.storage.get(ResourceComponentUpdates)!;
      this.z$_resource_component_last_write_tick = world.storage.get(ResourceComponentLastWriteTick)!;
      this.z$_resource_system_last_write_tick = world.storage.get(ResourceSystemLastWriteTick)!;
      this.z$_resource_world_tick = world.storage.get(ResourceWorldTick)!;

      //
      //

      logger.trace('world storage backend archetype initialized successfully');
   }

   //
   //

   entity_spawn_defer(
      definition: EntitySpawnDefinition
   ) {
      return entity_spawn_defer(
         this.z$_resource_command_buffer,
         //
         definition
      );
   }

   async entity_spawn_direct(
      definition: EntitySpawnDefinition,
      parent_id?: EntityId
   ) {
      return await entity_spawn_direct(
         this.z$_resource_world,
         //
         definition,
         parent_id
      );
   }

   async entity_create_direct() {
      return await entity_create_direct(
         this.z$_resource_world,
         //
         this.z$_resource_archetype_map,
         this.z$_resource_deleted_entities
      );
   }

   entity_delete_defer(
      entity: EntityId
   ) {
      return entity_delete_defer(
         this.z$_resource_command_buffer,
         //
         entity
      );
   }

   async entity_delete_multiple_direct(
      entities_to_delete: EntityId[]
   ) {
      return await entity_delete_multiple_direct(
         this.z$_resource_world,
         //
         entities_to_delete
      )
   }

   async entity_delete_direct(
      entity_id: EntityId,
      visited_during_delete: Set<EntityId> = new Set()
   ) {
      return await entity_delete_direct(
         this.z$_resource_world,
         //
         this.z$_resource_archetype_map,
         this.z$_resource_deleted_entities,
         this.z$_resource_component_entities,
         this.z$_resource_component_updates,
         this.z$_resource_component_last_write_tick,
         this.z$_resource_relationship_registry,
         this.z$_resource_world_tick,
         //
         entity_id,
         visited_during_delete
      );
   }

   entity_find_direct(
      component_names: string[]
   ) {
      return entity_find_direct(
         this.z$_resource_deleted_entities,
         this.z$_resource_component_entities,
         //
         component_names
      );
   }

   entity_find_multiple_direct(
      component_names: string[]
   ) {
      return entity_find_multiple_direct(
         this.z$_resource_deleted_entities,
         this.z$_resource_component_entities,
         //
         component_names
      )
   }

   entity_is_alive(
      entity_id: EntityId
   ) {
      return entity_is_alive(
         this.z$_resource_archetype_map,
         this.z$_resource_deleted_entities,
         //
         entity_id
      );
   }

   entity_parent_get(
      child_id: EntityId
   ) {
      return entity_parent_get(
         this.z$_resource_world,
         //
         child_id
      );
   }

   entity_children_get(
      parent_id: EntityId
   ) {
      return entity_children_get(
         this.z$_resource_world,
         //
         parent_id
      );
   }

   async entity_parent_set_direct(
      child_id: EntityId,
      parent_id?: EntityId
   ) {
      return await entity_parent_set_direct(
         this.z$_resource_world,
         //
         child_id,
         parent_id
      );
   }

   async *entity_view(
      options: {
         with?: string[];
         without?: string[];
      } = {}
   ): AsyncIterableIterator<EntityId> {
      yield* entity_view(
         this.z$_resource_archetype_map,
         this.z$_resource_deleted_entities,
         this.z$_resource_component_last_write_tick,
         this.z$_resource_world_tick,
         this.z$_resource_query_cache,
         //
         options
      );
   }

   //
   //

   component_has(
      entity_id: EntityId,
      component_name: string
   ) {
      return component_has(
         this.z$_resource_world,
         // 
         entity_id,
         component_name
      );
   }

   component_has_multiple(
      entity_id: EntityId,
      component_names: string[]
   ) {
      return component_has_multiple(
         this.z$_resource_world,
         // 
         entity_id,
         component_names
      );
   }

   component_get<C extends Component>(
      entity_id: EntityId,
      component_name: string
   ): C | undefined {
      return component_get(
         this.z$_resource_world,
         //
         this.z$_resource_archetype_map,
         //
         entity_id,
         component_name
      ) as C;
   }

   component_get_multiple<CC extends Component[]>(
      entity_id: EntityId,
      component_names: string[]
   ): {
         [K in keyof CC]: CC[K] | undefined
      } {
      return component_get_multiple(
         this.z$_resource_world,
         //
         this.z$_resource_archetype_map,
         //
         entity_id,
         component_names
      ) as CC;
   }

   component_add_multiple_defer(
      entity: EntityId,
      component_definitions_to_add: ComponentDefinition[]
   ) {
      return component_add_multiple_defer(
         this.z$_resource_command_buffer,
         //
         entity,
         component_definitions_to_add
      );
   }

   async component_add_multiple_direct(
      entity: EntityId,
      component_definitions_to_add: ComponentDefinition[]
   ) {
      return await component_add_multiple_direct(
         this.z$_resource_world,
         // 
         this.z$_resource_archetype_map,
         this.z$_resource_deleted_entities,
         this.z$_resource_component_entities,
         this.z$_resource_component_updates,
         this.z$_resource_component_last_write_tick,
         this.z$_resource_world_tick,
         //
         entity,
         component_definitions_to_add
      );
   }

   component_remove_multiple_defer(
      entity: EntityId,
      names: string[]
   ) {
      return component_remove_multiple_defer(
         this.z$_resource_command_buffer,
         //
         entity,
         names
      )
   }

   async component_remove_multiple_direct(
      entity: EntityId,
      component_names_to_remove: string[],
   ) {
      return component_remove_multiple_direct(
         this.z$_resource_world,
         // 
         this.z$_resource_archetype_map,
         this.z$_resource_deleted_entities,
         this.z$_resource_component_entities,
         this.z$_resource_component_updates,
         this.z$_resource_component_last_write_tick,
         this.z$_resource_world_tick,
         //
         entity,
         component_names_to_remove
      );
   }

   component_validate_dependencies(
      final_names: Set<string>,
      dependencies?: ComponentDependencies,
      entity_id?: EntityId
   ) {
      return component_validate_dependencies(
         final_names,
         dependencies,
         entity_id
      );
   }

   component_is_registered(
      name: string
   ) {
      return component_is_registered(
         this.z$_resource_component_entities,
         //
         name
      );
   }

   component_get_all<CC extends ComponentConstructor[]>(
      entity_id: EntityId
   ): {
         [K in keyof CC]: InstanceType<CC[K]> | undefined
      } {
      return component_get_all(
         this.z$_resource_archetype_map,
         //
         entity_id
      )
   }

   async *component_view<CC extends ComponentConstructor[]>(
      component_names: string[],
      options: {
         with?: string[];
         without?: string[];
      } = {}
   ): AsyncIterableIterator<
      [
         EntityId,
         {
            [K in keyof CC]: InstanceType<CC[K]>;
         }
      ]
   > {
      yield* component_view(
         this.z$_resource_archetype_map,
         this.z$_resource_deleted_entities,
         this.z$_resource_component_last_write_tick,
         this.z$_resource_world_tick,
         this.z$_resource_query_cache,
         //
         component_names,
         options
      );
   }
}