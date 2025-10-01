/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-storage-backend-archetype/src/operations/archetype.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import { set_find_difference } from '@eldritch-engine/utils/std/set';

import type { Component } from '@eldritch-engine/ecs-core/types/component';
import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';

import { Archetype, ResourceArchetypeMap, type ArchetypeId } from '@self/ecs/resources/archetype';

/** calculates a canonical ArchetypeId from a set of component names. sorts names alphabetically to ensure uniqueness regardless of order */
export function archetype_calculate_id(
   names: Set<string>
): ArchetypeId {
   if (names.size === 0) {
      return '|empty|';
   }

   const names_sorted = [...names].sort();

   return names_sorted.join('|');
}

/** finds an existing archetype matching the set of component names, or creates a new one if it doesn't exist */
export function archetype_find_or_create(
   r_archetype_map: ResourceArchetypeMap,
   //
   names: Set<string>
): Archetype {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const archetype_id = archetype_calculate_id(names);

   let target_archetype = r_archetype_map.archetypes_by_id.get(archetype_id);

   if (!target_archetype) {
      const new_component_arrays = new Map<string, Component[]>();

      for (const name of names) {
         new_component_arrays.set(name, []);
      }

      target_archetype = new Archetype();
      target_archetype.id = archetype_id;
      target_archetype.entities = [];
      target_archetype.entity_to_index = new Map();
      target_archetype.component_names = names;
      target_archetype.component_arrays = new_component_arrays;

      r_archetype_map.archetypes_by_id.set(archetype_id, target_archetype);
      r_archetype_map.add_transitions.set(archetype_id, new Map());
      r_archetype_map.remove_transitions.set(archetype_id, new Map());

      logger.trace(`created new archetype ${archetype_id} for components: [${[...names].join(', ') || 'none'}]`);

      for (const name of names) {
         if (!r_archetype_map.archetypes_by_component_name.has(name)) {
            r_archetype_map.archetypes_by_component_name.set(name, new Set());
         }

         const archetype_set = r_archetype_map.archetypes_by_component_name.get(name)!;
         archetype_set.add(archetype_id);

         logger.trace(`adding id '${archetype_id}' to Set for component ${name}`);
      }

      archetype_update_graph(
         r_archetype_map,
         //
         target_archetype
      );
   }

   return target_archetype;
}

/** updates the archetype graph based on a newly created archetype */
export function archetype_update_graph(
   r_archetype_map: ResourceArchetypeMap,
   //
   new_archetype: Archetype
): void {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const new_archetype_id = new_archetype.id;
   const new_names = new_archetype.component_names;

   logger.trace(`updating transitions for new archetype ${new_archetype_id}`);

   for (const existing_archetype of r_archetype_map.archetypes_by_id.values()) {
      const existing_archetype_id = existing_archetype.id;
      const existing_names = existing_archetype.component_names;

      const diff = set_find_difference(new_names, existing_names);

      if (diff.added_to_a) {
         const component_c = diff.added_to_a;

         r_archetype_map.add_transitions.get(existing_archetype_id)?.set(component_c, new_archetype_id);
         r_archetype_map.remove_transitions.get(new_archetype_id)?.set(component_c, existing_archetype_id);

         logger.trace(`   -> graph edge: add ${component_c} to ${existing_archetype_id} => ${new_archetype_id}`);
         logger.trace(`   -> graph edge: remove ${component_c} from ${new_archetype_id} => ${existing_archetype_id}`);
      } else if (diff.added_to_b) {
         const component_c = diff.added_to_b;

         r_archetype_map.add_transitions.get(new_archetype_id)?.set(component_c, existing_archetype_id);
         r_archetype_map.remove_transitions.get(existing_archetype_id)?.set(component_c, new_archetype_id);

         logger.trace(`   -> graph edge: add ${component_c} to ${new_archetype_id} => ${existing_archetype_id}`);
         logger.trace(`   -> graph edge: remove ${component_c} from ${existing_archetype_id} => ${new_archetype_id}`);
      }
   }
}

/**
 * removes an entity and its component data from its current archetype using swap-and-pop.
 * 
 * @returns a Map of component names to the removed Component instance.
 */
export function archetype_remove_entity_from(
   r_archetype_map: ResourceArchetypeMap,
   //
   entity_id: EntityId
): Map<string, Component> | undefined {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const old_archetype_id = r_archetype_map.entity_to_archetype_id.get(entity_id);

   if (!old_archetype_id) {
      return;
   }

   const archetype = r_archetype_map.archetypes_by_id.get(old_archetype_id);

   /// #if SAFETY
   if (!archetype) {
      {
         const message = `entity ${entity_id} maps to non-existent archetype ${old_archetype_id}`;

         logger.critical(message);
         throw new Error(message);
      }
   }
   /// #endif

   const index_to_remove = archetype.entity_to_index.get(entity_id);

   /// #if SAFETY
   if (index_to_remove == null) {
      {
         const message = `entity ${entity_id} in archetype ${old_archetype_id} but missing from entity_to_index map`;

         logger.critical(message);
         throw new Error(message);
      }
   }
   /// #endif

   const removed_component_map = new Map<string, Component>();

   for (const [name, components] of archetype.component_arrays.entries()) {
      const component_instance = components[index_to_remove];

      if (component_instance) {
         removed_component_map.set(name, component_instance);
      }

      /// #if SAFETY
      else {
         {
            const message = `missing component instance for ${name} at index ${index_to_remove} for entity ${entity_id} in archetype ${archetype.id}`;

            logger.critical(message);
            throw new Error(message);
         }
      }
      /// #endif
   }

   const last_index = archetype.entities.length - 1;

   if (index_to_remove !== last_index) {
      const last_entity_id = archetype.entities[last_index]!;

      archetype.entities[index_to_remove] = last_entity_id;
      archetype.entity_to_index.set(last_entity_id, index_to_remove);

      for (const components of archetype.component_arrays.values()) {
         components[index_to_remove] = components[last_index]!;
      }

      logger.trace(`swapped entity ${entity_id} with ${last_entity_id} in archetype ${archetype.id}`);
   }

   /// #if LOGGER_HAS_TRACE
   else {
      logger.trace(`removing last entity ${entity_id} from archetype ${archetype.id}`);
   }
   /// #endif

   archetype.entities.pop();

   for (const components of archetype.component_arrays.values()) {
      components.pop();
   }

   archetype.entity_to_index.delete(entity_id);
   r_archetype_map.entity_to_archetype_id.delete(entity_id);

   logger.trace(`removed entity ${entity_id} from archetype ${archetype.id}. size: ${archetype.entities.length}`);

   if (
      archetype.entities.length === 0
      && archetype.id !== '|empty|'
   ) {
      archetype_cleanup(
         r_archetype_map,
         //
         archetype
      );
   }

   return removed_component_map;
}

/**
 * adds an entity and its component data to a specific archetype (appends to arrays).
 * 
 * assumes the component_map contains exactly the components required by the archetype.
 */
export function archetype_add_entity_to(
   r_archetype_map: ResourceArchetypeMap,
   //
   entity_id: EntityId,
   archetype_id: ArchetypeId,
   component_map: Map<string, Component>
): void {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const archetype = r_archetype_map.archetypes_by_id.get(archetype_id);

   /// #if SAFETY
   if (!archetype) {
      {
         const message = `attempted add to non-existent archetype ${archetype_id}`;

         logger.critical(message);
         throw new Error(message);
      }
   }
   /// #endif

   if (archetype.entity_to_index.has(entity_id)) {
      logger.warn(`entity ${entity_id} already exists in archetype ${archetype_id}. removing first`);

      archetype_remove_entity_from(
         r_archetype_map,
         //
         entity_id
      );
   }

   const new_index = archetype.entities.length;

   archetype.entities.push(entity_id);
   archetype.entity_to_index.set(entity_id, new_index);

   for (const [name, component_array] of archetype.component_arrays.entries()) {
      const component_instance = component_map.get(name);

      if (component_instance) {
         component_array.push(component_instance);
      }

      /// #if SAFETY
      else {
         {
            const message = `missing component ${name} in provided Map for entity ${entity_id} being added to archetype ${archetype_id}`;

            logger.critical(message);
            throw new Error(message);
         }
      }
      /// #endif
   }

   r_archetype_map.entity_to_archetype_id.set(entity_id, archetype_id);

   logger.trace(`added entity ${entity_id} to archetype ${archetype_id} at index ${new_index}. size: ${archetype.entities.length}`);
}

/**
 * moves an entity (and its components) from its old archetype to a new one.
 */
export function archetype_move_entity_to(
   r_archetype_map: ResourceArchetypeMap,
   //
   entity_id: EntityId,
   new_archetype_id: ArchetypeId,
   final_component_map: Map<string, Component>
): boolean {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const old_archetype_id = r_archetype_map.entity_to_archetype_id.get(entity_id);

   if (old_archetype_id === new_archetype_id) {
      return false;
   }

   logger.trace(`moving entity ${entity_id} from ${old_archetype_id ?? 'none'} to ${new_archetype_id}`);

   if (old_archetype_id) {
      const removed_map = archetype_remove_entity_from(
         r_archetype_map,
         //
         entity_id
      );

      /// #if SAFETY
      if (!removed_map) {
         {
            const message = `failed to remove entity ${entity_id} from old archetype ${old_archetype_id}`;

            logger.critical(message);
            throw new Error(message);
         }
      }
      /// #endif
   }

   archetype_add_entity_to(
      r_archetype_map,
      //
      entity_id,
      new_archetype_id,
      final_component_map
   );

   return true;
}

/** finds archetypes compatible with a query */
export function archetype_find_matching(
   r_archetype_map: ResourceArchetypeMap,
   //
   required_components: string[]
): Set<ArchetypeId> {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   if (required_components.length === 0) {
      return new Set();
   }

   const query_for = required_components.join(', ');

   let matching_archetype_ids: Set<ArchetypeId> | undefined = undefined;

   for (const name of required_components) {
      const archetypes_with_component = r_archetype_map.archetypes_by_component_name.get(name);

      /// #if SAFETY
      if (
         !archetypes_with_component
         || archetypes_with_component.size === 0
      ) {
         logger.trace(`component ${name} not found in any archetype. query for [${query_for}] will yield no results`);

         return new Set();
      }
      /// #endif

      if (matching_archetype_ids == null) {
         matching_archetype_ids = new Set(archetypes_with_component);
      } else {
         const current_matching_ids = matching_archetype_ids;

         matching_archetype_ids = new Set();

         for (const id of archetypes_with_component) {
            if (current_matching_ids.has(id)) {
               matching_archetype_ids.add(id);
            }
         }

         /// #if SAFETY
         if (matching_archetype_ids.size === 0) {
            logger.warn(`intersection became empty after checking ${name}. query for [${query_for}] yields no results`);

            return matching_archetype_ids;
         }
         /// #endif
      }
   }

   const final_result = matching_archetype_ids ?? new Set();

   logger.trace(`final matching archetype ids for [${query_for}]: {${[...final_result].join(', ')}}`);

   return final_result;
}

/** given an entity's current archetype, calculates the target archetype after adding/removing components. uses the archetype graph for single changes if possible */
export function archetype_get_target_after_change(
   r_archetype_map: ResourceArchetypeMap,
   //
   entity_id: EntityId,
   added?: string[],
   removed?: string[]
): Archetype {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const current_archetype_id = r_archetype_map.entity_to_archetype_id.get(entity_id);
   const current_archetype = current_archetype_id ? r_archetype_map.archetypes_by_id.get(current_archetype_id) : undefined;

   const is_single_add = added?.length === 1
      && (!removed || removed.length === 0);

   const is_single_remove = removed?.length === 1
      && (!added || added.length === 0);

   if (
      current_archetype_id
      && (
         is_single_add
         || is_single_remove
      )
   ) {
      if (is_single_add) {
         const added_comp = added[0]!;

         const target_id = r_archetype_map.add_transitions.get(current_archetype_id)?.get(added_comp);
         const target_archetype = target_id ? r_archetype_map.archetypes_by_id.get(target_id) : undefined;

         if (target_archetype) {
            logger.trace(`graph hit (add ${added_comp}): ${current_archetype_id} -> ${target_id}`);

            return target_archetype;
         }

         logger.trace(`graph miss (add ${added_comp}): no transition from ${current_archetype_id}`);
      } else if (is_single_remove) {
         const removed_comp = removed![0]!;
         const target_id = r_archetype_map.remove_transitions.get(current_archetype_id)?.get(removed_comp);
         const target_archetype = target_id ? r_archetype_map.archetypes_by_id.get(target_id) : undefined;

         if (target_archetype) {
            logger.trace(`graph hit (remove ${removed_comp}): ${current_archetype_id} -> ${target_id}`);

            return target_archetype;
         }

         logger.trace(`graph miss (remove ${removed_comp}): no transition from ${current_archetype_id}`);
      }
   }

   /// #if LOGGER_HAS_TRACE
   if (
      current_archetype_id
      && (
         is_single_add
         || is_single_remove
      )
   ) {
      logger.trace(`falling back to calculation for entity ${entity_id}`);
   }
   /// #endif

   const target_names = current_archetype
      ? new Set(current_archetype.component_names)
      : new Set<string>();

   if (added) {
      for (const name of added) {
         target_names.add(name);
      }
   }

   if (removed) {
      for (const name of removed) {
         target_names.delete(name);
      }
   }

   return archetype_find_or_create(
      r_archetype_map,
      //
      target_names
   );
}

export function archetype_cleanup(
   r_archetype_map: ResourceArchetypeMap,
   //
   archetype: Archetype
): void {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   if (
      archetype.entities.length > 0
      || archetype.id === '|empty|'
   ) {
      return;
   }

   const archetype_id = archetype.id;

   logger.trace(`cleaning up empty archetype: ${archetype_id}`);

   r_archetype_map.archetypes_by_id.delete(archetype_id);

   for (const name of archetype.component_names) {
      r_archetype_map.archetypes_by_component_name.get(name)?.delete(archetype_id);
   }

   for (const add_map of r_archetype_map.add_transitions.values()) {
      for (const [comp, target_id] of add_map.entries()) {
         if (target_id === archetype_id) {
            add_map.delete(comp);
         }
      }
   }

   for (const remove_map of r_archetype_map.remove_transitions.values()) {
      for (const [comp, target_id] of remove_map.entries()) {
         if (target_id === archetype_id) {
            remove_map.delete(comp);
         }
      }
   }

   r_archetype_map.add_transitions.delete(archetype_id);
   r_archetype_map.remove_transitions.delete(archetype_id);
}