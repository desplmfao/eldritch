/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-storage-backend-archetype/src/operations/component.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import { deep_clone } from '@eldritch-engine/utils/std/object';
import { SparseSet } from '@eldritch-engine/utils/std/sparse_set';

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';
import type { Component, ComponentConstructor, ComponentDefinition, ComponentDependencies } from '@eldritch-engine/ecs-core/types/component';
import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';
import { RelationshipTargetBase } from '@eldritch-engine/ecs-core/types/relationship';

import type { ResourceCommandBuffer } from '@eldritch-engine/ecs-core/ecs/resources/command_buffer';
import { query_cache_generate_key, type ResourceQueryCache } from '@self/ecs/resources/query_cache';

import type {
   ResourceEntitiesDeleted,
   ResourceComponentEntities,
   ResourceComponentUpdates,
   ResourceComponentLastWriteTick,
   ResourceWorldTick
} from '@eldritch-engine/ecs-core/ecs/resources/core';

import { archetype_find_matching, archetype_find_or_create, archetype_move_entity_to } from '@self/operations/archetype';
import type { Archetype, ArchetypeId, ResourceArchetypeMap } from '@self/ecs/resources/archetype';

export function component_add_multiple_defer(
   r_command_buffer: ResourceCommandBuffer,
   //
   entity: EntityId,
   component_definitions_to_add: ComponentDefinition[]
): void {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   /// #if SAFETY
   const component_type_names = new Set<string>();

   for (const [ctor] of component_definitions_to_add) {
      const name = ctor.name;

      if (component_type_names.has(name)) {
         const message = `entity '${entity}': cannot defer add of multiple components of the same type ('${name}') in a single call`;

         logger.critical(message);
         throw new Error(message);
      }

      component_type_names.add(name);
   }
   /// #endif

   if (r_command_buffer.delete_entity_commands.has(entity)) {
      return;
   }

   if (!r_command_buffer.add_component_commands.has(entity)) {
      r_command_buffer.add_component_commands.set(entity, []);
   }

   const pending_adds = r_command_buffer.add_component_commands.get(entity)!;

   for (const definition_to_add of component_definitions_to_add) {
      const [ctor] = definition_to_add;

      const pending_removes = r_command_buffer.remove_component_commands.get(entity);

      if (pending_removes?.has(ctor.name)) {
         pending_removes.delete(ctor.name);
      }

      const existing_index = pending_adds.findIndex((p) => p[0] === ctor);

      if (existing_index !== -1) {
         pending_adds[existing_index] = definition_to_add;
      } else {
         pending_adds.push(definition_to_add);
      }
   }
}

export function component_remove_multiple_defer(
   r_command_buffer: ResourceCommandBuffer,
   //
   entity: EntityId,
   names: string[]
): void {
   if (r_command_buffer.delete_entity_commands.has(entity)) {
      return;
   }

   if (!r_command_buffer.remove_component_commands.has(entity)) {
      r_command_buffer.remove_component_commands.set(entity, new Set());
   }

   const pending_removes = r_command_buffer.remove_component_commands.get(entity)!;
   const pending_adds = r_command_buffer.add_component_commands.get(entity)!;

   for (const name of names) {
      pending_removes.add(name);

      if (pending_adds) {
         const index = pending_adds.findIndex((p) => p[0].name === name);

         if (index > -1) {
            pending_adds.splice(index, 1);
         }
      }
   }

   if (
      pending_adds
      && pending_adds.length === 0
   ) {
      r_command_buffer.add_component_commands.delete(entity);
   }
}

export function component_has(
   world: IWorld,
   //
   entity_id: EntityId,
   component_name: string
): boolean {
   return world.component_get_from_name(entity_id, component_name) != null;
}

export function component_has_multiple(
   world: IWorld,
   //
   entity_id: EntityId,
   component_names: string[]
): boolean[] {
   const has = world.component_get_from_name_multiple(entity_id, component_names);
   const results: boolean[] = new Array(has.length);

   for (let i = 0; i < has.length; i++) {
      results[i] = has[i] != null;
   }

   return results;
}

export function component_get<C extends ComponentConstructor>(
   world: IWorld,
   //
   r_archetypes: ResourceArchetypeMap,
   //
   entity_id: EntityId,
   component_name: string
): InstanceType<C> | undefined {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const results = component_get_multiple<[C]>(
      world,
      //
      r_archetypes,
      //
      entity_id,
      [component_name]
   );

   /// #if LOGGER_HAS_TRACE
   if (results[0]) {
      const archetype_id = r_archetypes.entity_to_archetype_id.get(entity_id)!;
      const archetype = r_archetypes.archetypes_by_id.get(archetype_id)!;
      const entity_index = archetype.entity_to_index.get(entity_id)!;

      logger.trace(`entity '${entity_id}': successfully retrieved single component ${component_name} from archetype ${archetype_id} at index ${entity_index}`);
   }
   /// #endif

   return results[0];
}

export function component_get_multiple<CC extends ComponentConstructor[]>(
   world: IWorld,
   //
   r_archetypes: ResourceArchetypeMap,
   entity_id: EntityId,
   //
   component_names: string[]
): {
      [K in keyof CC]: InstanceType<CC[K]> | undefined
   } {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   /// #if SAFETY
   if (!world.entity_is_alive(entity_id)) {
      return new Array(component_names.length).fill(undefined) as any;
   }
   /// #endif

   const archetype_id = r_archetypes.entity_to_archetype_id.get(entity_id)!;
   const archetype = r_archetypes.archetypes_by_id.get(archetype_id);

   /// #if SAFETY
   if (!archetype) {
      {
         const message = `entity '${entity_id}': maps to archetype ${archetype_id}, but archetype not found`;

         logger.critical(message);
         throw new Error(message);
      }
   }
   /// #endif

   const entity_index = archetype.entity_to_index.get(entity_id);

   /// #if SAFETY
   if (entity_index == null) {
      {
         const message = `entity '${entity_id}': archetype ${archetype_id} found, but entity index missing`;

         logger.critical(message);
         throw new Error(message);
      }
   }
   /// #endif

   const results = [] as {
      [K in keyof CC]: InstanceType<CC[K]> | undefined;
   };

   for (const name of component_names) {
      if (!archetype.component_names.has(name)) {
         results.push(undefined);

         continue;
      }

      const component_array = archetype.component_arrays.get(name);

      /// #if SAFETY
      if (!component_array) {
         {
            const message = `entity '${entity_id}': archetype ${archetype_id} has component ${name} in name set, but component array is missing`;

            logger.critical(message);
            throw new Error(message);
         }
      }
      /// #endif

      const instance = component_array[entity_index];

      /// #if SAFETY
      if (instance == null) {
         {
            const message = `entity '${entity_id}': component ${name} is undefined at index ${entity_index} in archetype ${archetype_id}`;

            logger.critical(message);
            throw new Error(message);
         }
      }
      /// #endif

      results.push(instance);
   }

   return results;
}

export async function component_add_multiple_direct(
   world: IWorld,
   //
   r_archetypes: ResourceArchetypeMap,
   r_deleted_entities: ResourceEntitiesDeleted,
   r_component_entities: ResourceComponentEntities,
   r_component_updates: ResourceComponentUpdates,
   r_component_last_write_tick: ResourceComponentLastWriteTick,
   r_world_tick: ResourceWorldTick,
   //
   entity: EntityId,
   component_definitions_to_add: ComponentDefinition[]
): Promise<boolean> {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const components_to_add: Component[] = [];

   for (const [ctor, initializer] of component_definitions_to_add) {
      const instance = new ctor();

      Object.assign(instance, initializer ?? ctor.default);
      components_to_add.push(instance);
   }

   /// #if SAFETY
   const component_type_names = new Set<string>();

   for (const component of components_to_add) {
      const name = component.constructor.name;

      if (component_type_names.has(name)) {
         const message = `entity '${entity}': cannot add multiple components of the same type ('${name}') in a single call`;

         logger.critical(message);
         throw new Error(message);
      }

      component_type_names.add(name);
   }
   /// #endif

   /// #if SAFETY
   if (r_deleted_entities.data.has(entity)) {
      {
         const message = `entity '${entity}': failed direct component add, entity is deleted`;

         logger.critical(message);
         throw new Error(message);
      }
   }
   /// #endif

   const current_archetype_id = r_archetypes.entity_to_archetype_id.get(entity);
   const current_archetype = current_archetype_id ? r_archetypes.archetypes_by_id.get(current_archetype_id) : undefined;

   /// #if SAFETY
   if (!current_archetype) {
      {
         const message = `entity '${entity}': archetype map missing for direct add`;

         logger.critical(message);
         throw new Error(message);
      }
   }
   /// #endif

   const current_names = new Set(current_archetype.component_names);
   const final_names = new Set(current_names);
   const components_overwritten: Component[] = [];
   const components_actually_added: Component[] = [];
   const final_component_values = new Map<string, Component>();

   let changed = false;

   const validation_names = new Set(current_names);

   for (const component of components_to_add) {
      const name = component.constructor.name;

      const temp_final_names_for_validation = new Set(validation_names);
      temp_final_names_for_validation.add(name);

      try {
         world.component_validate_dependencies(temp_final_names_for_validation, component.dependencies, entity);
      } catch (e) {
         {
            const message = `entity '${entity}': validation failed adding component '${name}'. required dependency check failed\n${e.message}`;

            logger.critical(message);
            throw new Error(message, { cause: e });
         }
      }

      const existing_component = current_names.has(name) ? world.component_get_from_name(entity, name) : undefined;

      if (existing_component) {
         components_overwritten.push(existing_component);
         final_component_values.set(name, component);

         changed = true;
      } else {
         final_names.add(name);
         final_component_values.set(name, component);

         changed = true;
      }

      components_actually_added.push(component);

      validation_names.add(name);

      if (!r_component_entities.data.has(name)) {
         r_component_entities.data.set(name, new SparseSet());

         logger.trace(`created new SparseSet entry for component ${name}`);
      }

      r_component_entities.data.get(name)?.add(entity);

      if (!r_component_updates.data.has(name)) {
         r_component_updates.data.set(name, new Map());
      }
   }

   if (changed) {
      for (const overwritten_comp of components_overwritten) {
         await world.notify(
            'component_removed',
            //
            entity,
            overwritten_comp,
            {
               is_overwrite: true
            }
         );
      }

      const target_archetype = archetype_find_or_create(
         r_archetypes,
         //
         final_names
      );

      if (target_archetype.id !== current_archetype.id) {
         const final_components_for_move = new Map<string, Component>();

         for (const name of final_names) {
            const comp_to_use = final_component_values.get(name) ?? world.component_get_from_name(entity, name);

            if (comp_to_use) {
               final_components_for_move.set(name, comp_to_use);
            } else {
               {
                  const message = `entity '${entity}': inconsistency! expected component '${name}' to exist for archetype move construction after add/overwrite, but it was missing. target archetype: ${target_archetype.id}`;

                  logger.critical(message);
                  throw new Error(message);
               }
            }
         }

         archetype_move_entity_to(
            r_archetypes,
            //
            entity,
            target_archetype.id,
            final_components_for_move
         );

         logger.trace(`entity '${entity}': archetype updated to ${target_archetype.id} after direct component adds/overwrites`);
      } else {
         const archetype = r_archetypes.archetypes_by_id.get(current_archetype.id)!;
         const index = archetype.entity_to_index.get(entity)!;

         for (const component_to_add of components_to_add) {
            const name = component_to_add.constructor.name;

            if (current_names.has(name)) {
               archetype.component_arrays.get(name)![index] = component_to_add;

               logger.trace(`entity '${entity}': overwrote component instance for '${name}' in-place in archetype ${archetype.id}`);
            }
         }
      }

      for (const added_comp of components_actually_added) {
         const name = added_comp.constructor.name;

         await world.notify(
            'component_added',
            //
            entity,
            added_comp,
            {
               overwritten_component: components_overwritten.find(c => c.constructor.name === name)
            }
         );

         r_component_updates.data.get(name)?.set(entity, deep_clone(added_comp));
      }

      const final_archetype_of_entity = r_archetypes.archetypes_by_id.get(r_archetypes.entity_to_archetype_id.get(entity)!);

      if (final_archetype_of_entity) {
         for (const comp_name_in_final_archetype of final_archetype_of_entity.component_names) {
            r_component_last_write_tick.data.set(comp_name_in_final_archetype, r_world_tick.data);

            logger.trace(`entity '${entity}': tick update (add/overwrite) for ${comp_name_in_final_archetype} to ${r_world_tick.data}`);
         }
      }
   }

   return changed;
}

export async function component_remove_multiple_direct(
   world: IWorld,
   //
   r_archetypes: ResourceArchetypeMap,
   r_deleted_entities: ResourceEntitiesDeleted,
   r_component_entities: ResourceComponentEntities,
   r_component_updates: ResourceComponentUpdates,
   r_component_last_write_tick: ResourceComponentLastWriteTick,
   r_world_tick: ResourceWorldTick,
   //
   entity: EntityId,
   component_names_to_remove: string[],
): Promise<boolean> {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   /// #if SAFETY
   if (r_deleted_entities.data.has(entity)) {
      logger.warn(`entity '${entity}': attempted direct component remove, but entity is deleted. skipping`);

      return false;
   }
   /// #endif

   /// #if SAFETY
   if (component_names_to_remove.length === 0) {
      return false;
   }
   /// #endif

   const current_archetype_id = r_archetypes.entity_to_archetype_id.get(entity);
   const current_archetype = current_archetype_id ? r_archetypes.archetypes_by_id.get(current_archetype_id) : undefined;

   /// #if SAFETY
   if (!current_archetype) {
      {
         const message = `entity '${entity}': archetype map missing for direct remove, inconsistent state?`;

         logger.critical(message);
         throw new Error(message);
      }
   }
   /// #endif

   const current_names = new Set(current_archetype.component_names);
   const removal_set = new Set(component_names_to_remove);

   for (const name_to_check_removal of component_names_to_remove) {
      if (!current_names.has(name_to_check_removal)) {
         continue;
      }

      for (const remaining_name of current_names) {
         if (
            remaining_name === name_to_check_removal
            || removal_set.has(remaining_name)
         ) {
            continue;
         }

         const remaining_component_instance = world.component_get_from_name(entity, remaining_name);

         /// #if SAFETY
         if (!remaining_component_instance) {
            {
               const message = `entity '${entity}': inconsistency! archetype claims component ${remaining_name} exists, but component_get returned undefined during dependency check for removing ${name_to_check_removal}`;

               logger.critical(message);
               throw new Error(message);
            }
         }
         /// #endif

         /// #if SAFETY
         const dependencies = remaining_component_instance.dependencies?.components;

         if (
            dependencies
            && dependencies.includes(name_to_check_removal)
         ) {
            {
               const message = `entity '${entity}': cannot remove component '${name_to_check_removal}'. component '${remaining_name}' depends on it and is not being removed simultaneously`;

               logger.critical(message);
               throw new Error(message);
            }
         }
         /// #endif
      }
   }

   const final_names = new Set(current_names);
   const components_actually_removed: Component[] = [];

   let changed = false;

   for (const name of component_names_to_remove) {
      if (final_names.has(name)) {
         const component_instance = world.component_get_from_name(entity, name);

         if (component_instance) {
            components_actually_removed.push(component_instance);
         }

         /// #if SAFETY
         else {
            {
               const message = `entity '${entity}': expected component ${name} not found via component_get during removal finalization, despite archetype indicating presence`;

               logger.critical(message);
               throw new Error(message);
            }
         }
         /// #endif

         final_names.delete(name);
         changed = true;

         const sparse_set = r_component_entities.data.get(name);

         if (sparse_set) {
            sparse_set.delete(entity);

            if (sparse_set.size === 0) {
               r_component_entities.data.delete(name);
            }
         }

         const update_map = r_component_updates.data.get(name);

         if (update_map) {
            update_map.delete(entity);

            if (update_map.size === 0) {
               r_component_updates.data.delete(name);
            }
         }

         if (component_instance instanceof RelationshipTargetBase) {
            logger.warn(`entity '${entity}': removing RelationshipTarget ${name}. event handlers should manage source entities`);
         }
      }
   }

   if (changed) {
      const final_components_for_move = new Map<string, Component>();

      for (const name of final_names) {
         const comp = world.component_get_from_name(entity, name);

         if (comp) {
            final_components_for_move.set(name, comp);
         }

         /// #if SAFETY
         else {
            {
               const target_archetype = archetype_find_or_create(
                  r_archetypes,
                  //
                  final_names
               );

               const message = `entity '${entity}': inconsistency! expected component '${name}' to exist for archetype move construction after removal, but it was missing. target archetype: ${target_archetype.id}`;

               logger.critical(message);
               throw new Error(message);
            }
         }
         /// #endif
      }

      const target_archetype = archetype_find_or_create(
         r_archetypes,
         //
         final_names
      );

      const moved = archetype_move_entity_to(
         r_archetypes,
         //
         entity,
         target_archetype.id,
         final_components_for_move
      );

      if (moved) {
         logger.trace(`entity '${entity}': archetype updated to ${target_archetype.id} after direct component removals`);
      } else {
         /// #if SAFETY
         if (target_archetype.id !== current_archetype.id) {
            {
               const message = `entity '${entity}': inconsistency - removal changed component set but archetype_move_entity_to reported no move needed`;

               logger.critical(message);
               throw new Error(message);
            }
         }
         /// #endif

         logger.trace(`entity '${entity}': component removals did not result in archetype change (already in ${target_archetype.id})? this might be unexpected if components were actually removed`);
      }

      for (const removed_instance of components_actually_removed) {
         await world.notify(
            'component_removed',
            //
            entity,
            removed_instance,
            {
               is_overwrite: false
            }
         );
      }

      if (moved) {
         const final_archetype_of_entity = r_archetypes.archetypes_by_id.get(r_archetypes.entity_to_archetype_id.get(entity)!);

         if (final_archetype_of_entity) {
            for (const comp_name_in_final_archetype of final_archetype_of_entity.component_names) {
               r_component_last_write_tick.data.set(comp_name_in_final_archetype, r_world_tick.data);

               logger.trace(`entity '${entity}': tick update (remove path, in new arch) for ${comp_name_in_final_archetype} to ${r_world_tick.data}`);
            }
         }

         for (const removed_comp_name of component_names_to_remove) {
            if (current_names.has(removed_comp_name)) {
               r_component_last_write_tick.data.set(removed_comp_name, r_world_tick.data);

               logger.trace(`entity '${entity}': tick update (remove path, for removed comp) for ${removed_comp_name} to ${r_world_tick.data}`);
            }
         }
      } else if (changed) {
         for (const removed_comp_name of component_names_to_remove) {
            if (current_names.has(removed_comp_name) && !final_names.has(removed_comp_name)) {
               r_component_last_write_tick.data.set(removed_comp_name, r_world_tick.data);

               logger.trace(`entity '${entity}': tick update (remove, no move) for ${removed_comp_name} to ${r_world_tick.data}`);
            }
         }
      }
   }

   return changed;
}

export function component_validate_dependencies(
   final_names: Set<string>,
   dependencies?: ComponentDependencies,
   entity_id?: EntityId
): void {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const entity_context = entity_id != null ? ` for entity ${entity_id}` : '';

   if (dependencies?.components) {
      for (const required_name of dependencies.components) {
         /// #if SAFETY
         if (!final_names.has(required_name)) {
            {
               const message = `entity ${entity_id ?? '???'}: component dependency error: required component '${required_name}' is missing${entity_context}. final components: [${[...final_names].join(', ')}]`;

               logger.critical(message);
               throw new Error(message);
            }
         }
         /// #endif

         logger.trace(`entity ${entity_id ?? '???'}: dependency satisfied: ${required_name}`);
      }
   }
}

export function component_is_registered(
   r_component_entities: ResourceComponentEntities,
   //
   name: string
): boolean {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const sparse_set = r_component_entities.data.get(name);

   const is_registered = !!sparse_set
      && sparse_set.size > 0;

   logger.trace(`component ${name}: ${is_registered ? `registered (sparseset size: ${sparse_set?.size})` : 'not registered or sparseset is empty'}`);

   return is_registered;
}

export function component_get_all<CC extends ComponentConstructor[]>(
   r_archetype_map: ResourceArchetypeMap,
   //
   entity_id: EntityId
): {
      [K in keyof CC]: InstanceType<CC[K]> | undefined
   } {
   const archetype_id = r_archetype_map.entity_to_archetype_id.get(entity_id);

   const components = [] as {
      [K in keyof CC]: InstanceType<CC[K]> | undefined
   };

   if (!archetype_id) {
      return components;
   }

   const archetype = r_archetype_map.archetypes_by_id.get(archetype_id);

   if (!archetype) {
      return components;
   }

   const entity_index = archetype.entity_to_index.get(entity_id);

   if (entity_index == null) {
      return components;
   }

   for (const component_array of archetype.component_arrays.values()) {
      const component = component_array[entity_index];

      if (component) {
         components.push(component);
      }
   }

   return components;
}

export async function* component_view<CC extends ComponentConstructor[]>(
   r_archetypes: ResourceArchetypeMap,
   r_deleted_entities: ResourceEntitiesDeleted,
   r_component_last_write_tick: ResourceComponentLastWriteTick,
   r_world_tick: ResourceWorldTick,
   r_query_cache: ResourceQueryCache,
   //
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
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const required_by_with = options.with ?? [];
   const effectively_required = [...new Set([...component_names, ...required_by_with])];

   /// #if LOGGER_HAS_TRACE
   const names_debug = component_names.join(', ');
   const with_names_debug = options.with?.join(', ');
   const without_names_debug = options.without?.join(', ');

   logger.trace(`creating view for components: [${names_debug || '(none)'}]`
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
      logger.trace('view requested with no required components and no filters, returning empty iterator');

      return;
   }

   const query_key = query_cache_generate_key(component_names, options);
   const cached_entry = r_query_cache.cache.get(query_key);

   let cache_valid = false;

   const all_relevant_names = new Set([
      ...component_names,
      ...(options.with ?? []),
      ...(options.without ?? [])
   ]);

   if (cached_entry) {
      cache_valid = true;

      for (const name of all_relevant_names) {
         const last_write = r_component_last_write_tick.data.get(name) ?? -1;

         if (last_write >= cached_entry.last_validated_tick) {
            cache_valid = false;

            logger.trace(`cache invalid for key '${query_key}': component ${name} changed (tick ${last_write}) after cache validation (tick ${cached_entry.last_validated_tick})`);

            break;
         }
      }
   }

   if (
      cache_valid
      && cached_entry
   ) {
      logger.trace(`using cached result for query key '${query_key}' (validated at tick ${cached_entry.last_validated_tick})`);

      let yielded_count = 0;

      const cached_archetype_ids = cached_entry.result;

      for (const archetype_id of cached_archetype_ids) {
         const archetype = r_archetypes.archetypes_by_id.get(archetype_id);

         if (!archetype) {
            logger.warn(`cache hit for key '${query_key}', but cached archetype id ${archetype_id} no longer exists in world. skipping`);

            continue;
         }

         const component_arrays_for_query: Component[][] = [];
         let skip_this_archetype_for_query = false;

         for (const name of component_names) {
            const arr = archetype.component_arrays.get(name);

            if (!arr) {
               logger.warn(`cache hit for key '${query_key}', archetype ${archetype_id}: component array for '${name}' (requested in tuple) not found. this might indicate an issue with cache invalidation or archetype management if the archetype was expected to match. skipping this archetype for this query yield`);

               skip_this_archetype_for_query = true;

               break;
            }

            component_arrays_for_query.push(arr);
         }

         if (skip_this_archetype_for_query) {
            continue;
         }

         for (let i = 0; i < archetype.entities.length; i++) {
            const entity_id = archetype.entities[i]!;

            if (r_deleted_entities.data.has(entity_id)) {
               continue;
            }

            const result_components = component_arrays_for_query
               .map(arr => arr![i]) as {
                  [K in keyof CC]: InstanceType<CC[K]>;
               };

            yield [entity_id, result_components];

            yielded_count++;
         }
      }

      logger.trace(`yielded ${yielded_count} entities from cached view`);

      return;
   }

   logger.trace(`cache miss or invalid for key '${query_key}'. performing live query...`);

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

         if (
            options.without
            && options.without.length > 0
         ) {
            for (const without_name of options.without) {
               if (archetype.component_names.has(without_name)) {
                  continue archetype_loop;
               }
            }
         }

         let missing_required_array = false;

         /// #if SAFETY
         for (const req_name of component_names) {
            if (!archetype.component_arrays.has(req_name)) {
               {
                  const message = `live query inconsistency: archetype ${archetype.id} matches requirements but missing array for requested component ${req_name}`;

                  logger.critical(message);
                  throw new Error(message);
               }
            }
         }
         /// #endif

         if (missing_required_array) {
            continue;
         }

         live_matching_archetypes.push(archetype);
      }
   } else {
      if (r_world_tick.data === 0) {
         logger.trace(`attempted to query but failed on tick 0. query=${effectively_required.join(', ')}`);
      }
   }

   logger.trace(`live query found ${live_matching_archetypes.length} valid archetypes matching filters`);

   r_query_cache.cache.set(
      query_key,
      {
         result: live_matching_archetypes.map(archetype => archetype.id),
         last_validated_tick: r_world_tick.data,
      }
   );

   logger.trace(`cached new result (archetype id list) for key '${query_key}' at tick ${r_world_tick.data}`);

   let yielded_count = 0;

   for (const archetype of live_matching_archetypes) {
      const component_arrays_for_query = component_names
         .map(name => archetype.component_arrays.get(name)!);

      for (let i = 0; i < archetype.entities.length; i++) {
         const entity_id = archetype.entities[i]!;

         if (r_deleted_entities.data.has(entity_id)) {
            continue;
         }

         const result_components = component_arrays_for_query
            .map(arr => arr[i]) as {
               [K in keyof CC]: InstanceType<CC[K]>;
            };

         yield [entity_id, result_components];

         yielded_count++;
      }
   }

   logger.trace(`yielded ${yielded_count} entities from live view query`);
}