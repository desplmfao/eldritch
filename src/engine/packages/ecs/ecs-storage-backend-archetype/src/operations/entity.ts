/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-storage-backend-archetype/src/operations/entity.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';
import type { SparseSet } from '@eldritch-engine/utils/std/sparse_set';

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';
import type { EntityId, EntitySpawnDefinition } from '@eldritch-engine/ecs-core/types/entity';
import type { Component } from '@eldritch-engine/ecs-core/types/component';
import { RelationshipTargetBase } from '@eldritch-engine/ecs-core/types/relationship';

import type { ResourceRelationshipRegistry } from '@eldritch-engine/ecs-core/ecs/resources/relationship';
import type { ResourceCommandBuffer } from '@eldritch-engine/ecs-core/ecs/resources/command_buffer';

import {
   ResourceComponentEntities,
   ResourceComponentLastWriteTick,
   ResourceComponentUpdates,
   ResourceEntitiesDeleted,
   ResourceWorldTick
} from '@eldritch-engine/ecs-core/ecs/resources/core';

import { ComponentChildOf } from '@eldritch-engine/ecs-core/ecs/components/relationship/child_of';
import { ComponentChildren } from '@eldritch-engine/ecs-core/ecs/components/relationship/children';

import { relationship_get_metadata_by_target } from '@eldritch-engine/ecs-core/operations/relationship';

import { archetype_find_or_create, archetype_add_entity_to, archetype_remove_entity_from, archetype_find_matching } from '@self/operations/archetype';
import type { Archetype, ArchetypeId, ResourceArchetypeMap } from '@self/ecs/resources/archetype';
import { query_cache_generate_key, type ResourceQueryCache } from '@self/ecs/resources/query_cache';

export function entity_is_alive(
   r_archetypes: ResourceArchetypeMap,
   r_deleted_entities: ResourceEntitiesDeleted,
   //
   entity_id: EntityId
): boolean {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const exists_in_archetype = r_archetypes.entity_to_archetype_id.has(entity_id);
   const deleted = r_deleted_entities.data.has(entity_id);

   const alive = exists_in_archetype
      && !deleted;

   logger.trace(`entity ${entity_id} (entity_is_alive): exists_in_archetype=${exists_in_archetype}, deleted=${deleted}, alive=${alive}`);

   return alive;
}

export function entity_spawn_defer(
   r_command_buffer: ResourceCommandBuffer,
   //
   definition: EntitySpawnDefinition
): void {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   r_command_buffer.spawn_definitions.push(definition);

   logger.trace(`deferring spawn for entity with ${definition.children?.length ?? 0} direct children`);
}

export function entity_delete_defer(
   r_command_buffer: ResourceCommandBuffer,
   //
   entity: EntityId
): void {
   r_command_buffer.delete_entity_commands.add(entity);

   r_command_buffer.add_component_commands.delete(entity);
   r_command_buffer.remove_component_commands.delete(entity);
}

export async function entity_spawn_direct(
   world: IWorld,
   //
   definition: EntitySpawnDefinition,
   parent_id?: EntityId
): Promise<EntityId> {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   logger.trace(`attempting direct recursive spawn. parent has ${definition.components.length} components${(definition.children?.length ?? 0) > 0 ? ` and ${definition.children?.length ?? 0} direct children` : ''}`);

   const current_entity_id = await world.entity_create_direct();

   await world.component_add_multiple_direct(current_entity_id, definition.components);

   if (parent_id != null) {
      await world.entity_parent_set_direct(current_entity_id, parent_id);
   }

   if (
      definition.children
      && definition.children.length > 0
   ) {
      for (const child_definition of definition.children) {
         await world.entity_spawn_direct(child_definition, current_entity_id);
      }
   }

   return current_entity_id;
}

export async function entity_create_direct(
   world: IWorld,
   //
   r_archetypes: ResourceArchetypeMap,
   r_deleted_entities: ResourceEntitiesDeleted,
): Promise<EntityId> {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   let entity: EntityId;

   if (r_deleted_entities.data.size > 0) {
      entity = r_deleted_entities.data.values().next().value;
      r_deleted_entities.data.delete(entity);

      logger.trace(`reusing deleted entity id: ${entity}`);
   } else {
      entity = world.id_generator.next().value;

      logger.trace(`generated new entity id: ${entity}`);
   }

   const initial_component_map = new Map<string, Component>();

   const empty_archetype = archetype_find_or_create(
      r_archetypes,
      //
      new Set()
   );

   archetype_add_entity_to(
      r_archetypes,
      //
      entity,
      empty_archetype.id,
      initial_component_map
   );

   logger.trace(`entity '${entity}' added to empty archetype ${empty_archetype.id}`);

   await world.notify('entity_created', entity);

   return entity;
}

export async function entity_delete_multiple_direct(
   world: IWorld,
   //
   entities_to_delete: EntityId[]
): Promise<Map<EntityId, boolean>> {
   const results = new Map<EntityId, boolean>();
   const visited_in_batch = new Set<EntityId>();

   for (const entity_id of entities_to_delete) {
      if (!visited_in_batch.has(entity_id)) {
         const deleted = await world.entity_delete_direct(entity_id, visited_in_batch);

         results.set(entity_id, deleted);
      } else {
         results.set(entity_id, false);
      }
   }

   return results;
}

export async function entity_delete_direct(
   world: IWorld,
   //
   r_archetypes: ResourceArchetypeMap,
   r_deleted_entities: ResourceEntitiesDeleted,
   r_component_entities: ResourceComponentEntities,
   r_component_updates: ResourceComponentUpdates,
   r_component_last_write_tick: ResourceComponentLastWriteTick,
   r_relationship_registry: ResourceRelationshipRegistry,
   r_world_tick: ResourceWorldTick,
   //
   entity_id: EntityId,
   visited_during_delete: Set<EntityId> = new Set()
): Promise<boolean> {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   if (visited_during_delete.has(entity_id)) {
      return false;
   }

   const current_archetype_id = r_archetypes.entity_to_archetype_id.get(entity_id);

   if (
      !current_archetype_id
      || r_deleted_entities.data.has(entity_id)
   ) {
      return false;
   }

   visited_during_delete.add(entity_id);

   const removed_component_map = archetype_remove_entity_from(
      r_archetypes,
      //
      entity_id
   );

   /// #if SAFETY
   if (!removed_component_map) {
      {
         const message = `entity '${entity_id}': failed to remove entity from its archetype '${current_archetype_id}' during deletion. internal archetype state might be inconsistent`

         logger.critical(message);
         throw new Error(message);
      }
   }
   /// #endif

   for (const component of removed_component_map.values()) {
      await world.notify(
         'component_removed',
         //
         entity_id,
         component,
         {
            is_overwrite: false,
         }
      );
   }

   for (const component of removed_component_map.values()) {
      if (component instanceof RelationshipTargetBase) {
         const metadata = relationship_get_metadata_by_target(r_relationship_registry, component.constructor.name);

         if (
            metadata
            && metadata.linked_spawn
         ) {
            logger.trace(`entity '${entity_id}': linked_spawn active for ${component.constructor.name}. recursively deleting: ${component.source_entities.size} entities`);

            for (const source_id of component.source_entities.values()) {
               await world.entity_delete_direct(source_id, visited_during_delete);
            }
         }
      }
   }

   for (const component_name of removed_component_map.keys()) {
      const sparse_set = r_component_entities.data.get(component_name);

      if (sparse_set) {
         sparse_set.delete(entity_id);

         if (sparse_set.size === 0) {
            r_component_entities.data.delete(component_name);
         }
      }

      r_component_updates.data.get(component_name)?.delete(entity_id);
      r_component_last_write_tick.data.set(component_name, r_world_tick.data);

      if (r_component_updates.data.get(component_name)?.size === 0) {
         r_component_updates.data.delete(component_name);
      }
   }

   r_deleted_entities.data.add(entity_id);

   await world.notify('entity_deleted', entity_id);

   logger.trace(`entity '${entity_id}': deleted successfully`);

   return true;
}

export function entity_find_direct(
   r_deleted_entities: ResourceEntitiesDeleted,
   r_component_entities: ResourceComponentEntities,
   //
   component_names: string[]
): EntityId | undefined {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   if (component_names.length === 0) {
      return;
   }

   /// #if LOGGER_HAS_TRACE
   const names = component_names.join(', ');

   logger.trace(`searching for FIRST entity with components: [${names}]`);
   /// #endif

   let smallest_set: SparseSet | undefined = undefined;
   let smallest_set_name: string | undefined = undefined;

   const other_names: string[] = [];

   for (const name of component_names) {
      const current_set = r_component_entities.data.get(name);

      if (
         !current_set
         || current_set.size === 0
      ) {
         logger.trace(`   -> component ${name} has no entities, returning nothing`);

         return;
      }

      if (
         !smallest_set
         || current_set.size < smallest_set.size
      ) {
         if (smallest_set_name) {
            other_names.push(smallest_set_name);
         }

         smallest_set = current_set;
         smallest_set_name = name;
      } else {
         other_names.push(name);
      }
   }

   /// #if SAFETY
   if (!smallest_set) {
      {
         const message = `smallest_set not found despite checks`;

         logger.critical(message);
         throw new Error(message);
      }
   }
   /// #endif

   logger.trace(`   -> iterating smallest set for ${smallest_set_name} (size ${smallest_set.size})`);
   logger.trace(`   -> checking against other components: [${other_names.join(', ')}]`);

   for (const entity_id of smallest_set.values()) {
      if (r_deleted_entities.data.has(entity_id)) {
         continue;
      }

      let match = true;

      for (const other_name of other_names) {
         const other_set = r_component_entities.data.get(other_name);

         if (
            !other_set
            || !other_set.has(entity_id)
         ) {
            match = false;

            break;
         }
      }

      if (match) {
         logger.trace(`   -> found first matching entity: ${entity_id}`);

         return entity_id;
      }
   }

   logger.trace(' -> no matching active entity found after iterating smallest set');

   return;
}

export function entity_find_multiple_direct(
   r_deleted_entities: ResourceEntitiesDeleted,
   r_component_entities: ResourceComponentEntities,
   //
   component_names: string[]
): Set<EntityId> {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const result_set = new Set<EntityId>();

   if (component_names.length === 0) {
      return result_set;
   }

   /// #if LOGGER_HAS_TRACE
   const names = component_names.join(', ');

   logger.trace(`searching for ALL entities with components: [${names}]`);
   /// #endif

   let smallest_set: SparseSet | undefined = undefined;
   let smallest_set_name: string | undefined = undefined;

   const other_names: string[] = [];

   for (const name of component_names) {
      const current_set = r_component_entities.data.get(name);

      if (
         !current_set
         || current_set.size === 0
      ) {
         logger.trace(`   -> component ${name} has no entities, returning empty set`);

         return result_set;
      }

      if (
         !smallest_set
         || current_set.size < smallest_set.size
      ) {
         if (smallest_set_name) {
            other_names.push(smallest_set_name);
         }

         smallest_set = current_set;
         smallest_set_name = name;
      } else {
         other_names.push(name);
      }
   }

   /// #if SAFETY
   if (!smallest_set) {
      {
         const message = `smallest_set not found despite checks`;

         logger.critical(message);
         throw new Error(message);
      }
   }
   /// #endif

   logger.trace(`   -> iterating smallest set for ${smallest_set_name} (size ${smallest_set.size})`);
   logger.trace(`   -> checking against other components: [${other_names.join(', ')}]`);

   for (const entity_id of smallest_set.values()) {
      if (r_deleted_entities.data.has(entity_id)) {
         continue;
      }

      let match = true;

      for (const other_name of other_names) {
         const other_set = r_component_entities.data.get(other_name);

         if (
            !other_set
            || !other_set.has(entity_id)
         ) {
            match = false;

            break;
         }
      }

      if (match) {
         result_set.add(entity_id);
      }
   }

   logger.trace(`   -> found ${result_set.size} matching entities`);

   return result_set;
}

export function entity_parent_get(
   world: IWorld,
   //
   child_id: EntityId
): EntityId | undefined {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const child_of_comp = world.component_get(child_id, ComponentChildOf);

   if (child_of_comp) {
      const parent_id = child_of_comp.target_entity_id;

      logger.trace(`entity ${child_id}: found parent ${parent_id} via ComponentChildOf`);

      return parent_id;
   }

   logger.trace(`entity ${child_id}: ComponentChildOf not found`);

   return;
}

export function entity_children_get(
   world: IWorld,
   //
   parent_id: EntityId
): EntityId[] {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const children_comp = world.component_get(parent_id, ComponentChildren);

   if (children_comp) {
      const children_copy = [...children_comp.source_entities.values()];

      logger.trace(`entity ${parent_id}: found ${children_comp.source_entities.size} children: [${children_copy.join(', ')}]`);

      return children_copy;
   }

   logger.trace(`entity ${parent_id}: ComponentChildren not found or entity not alive`);

   return [];
}

export async function entity_parent_set_direct(
   world: IWorld,
   //
   child_id: EntityId,
   parent_id?: EntityId
): Promise<boolean> {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   /// #if SAFETY
   if (!world.entity_is_alive(child_id)) {
      {
         const message = `entity ${child_id}: cannot set parent, child entity is not alive`;

         logger.critical(message);
         throw new Error(message);
      }
   }

   if (
      parent_id != null
      && !world.entity_is_alive(parent_id)
   ) {
      {
         const message = `entity ${child_id}: cannot set parent to ${parent_id}, target parent entity is not alive`;

         logger.critical(message);
         throw new Error(message);
      }
   }
   /// #endif

   const current_parent_comp = world.component_get(child_id, ComponentChildOf);
   const current_parent_id = current_parent_comp?.target_entity_id;

   if (current_parent_id === parent_id) {
      logger.trace(`entity ${child_id}: already parented to ${parent_id ?? 'null'}, no change needed`);

      return true;
   }

   if (parent_id != null) {
      logger.trace(`entity ${child_id}: adding/overwriting ComponentChildOf for new parent ${parent_id}`);

      return await world.component_add_multiple_direct(
         child_id,
         [
            [ComponentChildOf, { target_entity_id: parent_id }]
         ]
      );
   } else {
      if (current_parent_comp) {
         logger.trace(`entity ${child_id}: removing ComponentChildOf (pointing to ${current_parent_id})`);

         return await world.component_remove_multiple_direct(
            child_id,
            [ComponentChildOf.name]
         );
      }

      return false;
   }
}

export async function* entity_view(
   r_archetypes: ResourceArchetypeMap,
   r_deleted_entities: ResourceEntitiesDeleted,
   r_component_last_write_tick: ResourceComponentLastWriteTick,
   r_world_tick: ResourceWorldTick,
   r_query_cache: ResourceQueryCache,
   //
   options: {
      with?: string[];
      without?: string[];
   } = {}
): AsyncIterableIterator<EntityId> {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const effectively_required = options.with ?? [];

   /// #if LOGGER_HAS_TRACE
   const with_names_debug = options.with?.join(', ');
   const without_names_debug = options.without?.join(', ');

   logger.trace(`creating entity view`
      + (with_names_debug ? ` with [${with_names_debug}]` : '')
      + (without_names_debug ? ` without [${without_names_debug}]` : '')
   );
   /// #endif

   if (
      effectively_required.length === 0
      && (
         !options.without
         || options.without.length === 0
      )
   ) {
      logger.trace('entity view requested with no required components and no filters, returning empty iterator');

      return;
   }

   const query_key = query_cache_generate_key([], options);
   const cached_entry = r_query_cache.cache.get(query_key);

   let cache_valid = false;

   const all_relevant_names = new Set([
      ...(options.with ?? []),
      ...(options.without ?? [])
   ]);

   if (cached_entry) {
      cache_valid = true;

      for (const name of all_relevant_names) {
         const last_write = r_component_last_write_tick.data.get(name) ?? -1;

         if (last_write >= cached_entry.last_validated_tick) {
            cache_valid = false;

            logger.trace(`cache invalid for entity_view key '${query_key}': component ${name} changed (tick ${last_write}) after cache validation (tick ${cached_entry.last_validated_tick})`);

            break;
         }
      }
   }

   if (
      cache_valid
      && cached_entry
   ) {
      logger.trace(`using cached result for entity_view key '${query_key}' (validated at tick ${cached_entry.last_validated_tick})`);

      let yielded_count = 0;
      const cached_archetype_ids = cached_entry.result;

      for (const archetype_id of cached_archetype_ids) {
         const archetype = r_archetypes.archetypes_by_id.get(archetype_id);

         if (!archetype) {
            logger.warn(`cache hit for entity_view key '${query_key}', but cached archetype id ${archetype_id} no longer exists. skipping`);

            continue;
         }

         for (const entity_id of archetype.entities) {
            if (r_deleted_entities.data.has(entity_id)) {
               continue;
            }

            yield entity_id;

            yielded_count++;
         }
      }

      logger.trace(`yielded ${yielded_count} entities from cached entity_view`);

      return;
   }

   logger.trace(`cache miss or invalid for entity_view key '${query_key}'. performing live query...`);

   let matching_archetype_ids: Set<ArchetypeId>;

   if (effectively_required.length > 0) {
      matching_archetype_ids = archetype_find_matching(r_archetypes, effectively_required);
   } else {
      matching_archetype_ids = new Set(r_archetypes.archetypes_by_id.keys());
   }

   const live_matching_archetypes: Archetype[] = [];

   if (matching_archetype_ids.size > 0) {
      archetype_loop: for (const archetype_id of matching_archetype_ids) {
         const archetype = r_archetypes.archetypes_by_id.get(archetype_id);

         if (!archetype) {
            continue;
         }

         if (options.without && options.without.length > 0) {
            for (const without_name of options.without) {
               if (archetype.component_names.has(without_name)) {
                  continue archetype_loop;
               }
            }
         }

         live_matching_archetypes.push(archetype);
      }
   }

   logger.trace(`live entity_view query found ${live_matching_archetypes.length} valid archetypes matching filters`);

   r_query_cache.cache.set(
      query_key,
      {
         result: live_matching_archetypes.map(archetype => archetype.id),
         last_validated_tick: r_world_tick.data,
      }
   );

   logger.trace(`cached new result (archetype id list) for entity_view key '${query_key}' at tick ${r_world_tick.data}`);

   let yielded_count = 0;

   for (const archetype of live_matching_archetypes) {
      for (const entity_id of archetype.entities) {
         if (r_deleted_entities.data.has(entity_id)) {
            continue;
         }

         yield entity_id;

         yielded_count++;
      }
   }

   logger.trace(`yielded ${yielded_count} entities from live entity_view query`);
}