/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/operations/relationship.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@self/types/world';
import type { EntityId } from '@self/types/entity';
import type { Event } from '@self/types/event';
import type { RelationshipBase, RelationshipTargetBase, RelationshipMetadata } from '@self/types/relationship';

import type { ResourceRelationshipRegistry } from '@self/ecs/resources/relationship';

import type {
   ResourceComponentUpdates,
   ResourceComponentLastWriteTick,
   ResourceWorldTick
} from '@self/ecs/resources/core';

/**
 * registers a relationship type and its corresponding target type
 *
 * @param relationship_type the constructor of the Relationship component
 * @param target_type the constructor of the RelationshipTarget component
 *
 * @param linked_spawn whether deleting the target entity should delete the source entities
 */
export function relationship_register(
   relationship_registry: ResourceRelationshipRegistry,
   //
   relationship_type: string,
   target_type: string,
   //
   options: {
      linked_spawn: boolean
   }
): void {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const metadata: RelationshipMetadata = {
      relationship_type,
      target_type,
      linked_spawn: options.linked_spawn
   };

   if (relationship_registry.by_relationship_type.has(relationship_type)) {
      logger.warn(`overwriting registration for relationship type: ${relationship_type}`);
   }

   if (relationship_registry.by_target_type.has(target_type)) {
      logger.warn(`overwriting registration for target type: ${target_type}`);
   }

   relationship_registry.by_relationship_type.set(relationship_type, metadata);
   relationship_registry.by_target_type.set(target_type, metadata);

   logger.trace(`registered relationship: ${relationship_type} <=> ${target_type} (linked_spawn: ${options.linked_spawn})`);
}

/** gets the metadata associated with a Relationship component type */
export function relationship_get_metadata(
   relationship_registry: ResourceRelationshipRegistry,
   //
   relationship_type: string
): RelationshipMetadata | undefined {
   return relationship_registry.by_relationship_type.get(relationship_type);
}

/** gets the metadata associated with a RelationshipTarget component type */
export function relationship_get_metadata_by_target(
   relationship_registry: ResourceRelationshipRegistry,
   //
   target_type: string
): RelationshipMetadata | undefined {
   return relationship_registry.by_target_type.get(target_type);
}

/** checks if a component constructor is a registered Relationship type */
export function relationship_is_type(
   relationship_registry: ResourceRelationshipRegistry,
   //
   name: string
) {
   return relationship_registry.by_relationship_type.has(name);
}

/** checks if a component constructor is a registered RelationshipTarget type */
export function relationship_is_target_type(
   relationship_registry: ResourceRelationshipRegistry,
   //
   name: string
) {
   return relationship_registry.by_target_type.has(name);
}

export interface RelationshipEventProcessingResources {
   component_updates: ResourceComponentUpdates;
   component_last_write_tick: ResourceComponentLastWriteTick;
   world_tick: ResourceWorldTick;
}

export interface RelationshipEventNotificationConfig {
   source_added_to_target_event_name?: Event;
   source_removed_from_target_event_name?: Event;
   relationship_set_event_name?: Event;
}

export interface RelationshipHandlerContext {
   world: IWorld;
   resources: RelationshipEventProcessingResources;
   metadata: RelationshipMetadata;
   TargetComponentConstructor: new (options?: { source_entities: RelationshipTargetBase['source_entities'] }) => RelationshipTargetBase;
   notifications: RelationshipEventNotificationConfig;
}

/**
 * handles updating the new target entity when a relationship component is added to a source entity
 * 
 * this includes ensuring the target has the corresponding target-side component, adding the source to its list, and triggering notifications
 */
export async function update_new_target_on_relationship_added(
   context: RelationshipHandlerContext,
   source_entity_id: EntityId,
   relationship_component_added: RelationshipBase,
   old_target_id_for_set_event?: EntityId
): Promise<void> {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const { world, resources, metadata, TargetComponentConstructor, notifications } = context;
   const { component_updates, component_last_write_tick, world_tick } = resources;
   const { target_type } = metadata;

   const relationship_component_name = relationship_component_added.constructor.name;
   const current_target_id = relationship_component_added.target_entity_id;

   if (!world.entity_is_alive(current_target_id)) {
      logger.warn(`entity ${source_entity_id}: relationship ${relationship_component_name} points to non-existent/deleted target ${current_target_id}. removing ${relationship_component_name}`);

      await world.component_remove_multiple_direct(source_entity_id, [relationship_component_name]);

      return;
   }

   let target_side_comp = world.component_get_from_name<RelationshipTargetBase>(current_target_id, target_type);

   if (!target_side_comp) {
      logger.trace(`entity ${current_target_id}: creating new target component ${target_type} due to relationship from ${source_entity_id}`);

      await world.component_add_multiple_direct(
         current_target_id,
         [
            [
               TargetComponentConstructor,
               {}
            ]
         ]
      );

      target_side_comp = world.component_get_from_name<RelationshipTargetBase>(current_target_id, target_type);

      if (!target_side_comp) {
         {
            const message = `entity ${current_target_id}: failed to get ${target_type} even after adding it`;

            logger.critical(message);
            throw new Error(message);
         }
      }
   }

   if (!target_side_comp.source_entities.has(source_entity_id)) {
      target_side_comp.source_entities.add(source_entity_id);

      const target_comp_updates_map = component_updates.data.get(target_type);

      if (target_comp_updates_map) {
         const cloned_target_comp = new TargetComponentConstructor({
            source_entities: target_side_comp.source_entities
         });

         target_comp_updates_map.set(current_target_id, cloned_target_comp);
         component_last_write_tick.data.set(target_type, world_tick.data);
      } else {
         logger.warn(`entity ${current_target_id}: component_updates resource missing for ${target_type}`);
      }

      logger.trace(`entity ${current_target_id}: added source ${source_entity_id} to ${target_type}. new count: ${target_side_comp.source_entities.size}`);

      if (notifications.source_added_to_target_event_name) {
         await world.notify(
            notifications.source_added_to_target_event_name,
            current_target_id,
            source_entity_id
         );
      }

      if (notifications.relationship_set_event_name) {
         await world.notify(
            notifications.relationship_set_event_name,
            //
            source_entity_id,
            current_target_id,
            old_target_id_for_set_event
         );
      }
   } else {
      logger.trace(`entity ${current_target_id}: source ${source_entity_id} already in ${target_type}`)

      if (
         old_target_id_for_set_event != null
         && notifications.relationship_set_event_name
      ) {
         await world.notify(
            notifications.relationship_set_event_name,
            //
            source_entity_id,
            current_target_id,
            old_target_id_for_set_event
         );
      }
   }
}

/**
 * handles updating the (former) target entity when a relationship component is removed from a source entity
 * 
 * this includes removing the source from the target-side component's list, potentially removing the target-side component if its list becomes empty, and triggering notifications
 */
export async function update_target_on_relationship_removed(
   context: RelationshipHandlerContext,
   source_entity_id: EntityId,
   relationship_component_removed: RelationshipBase,
   is_overwrite: boolean = false
): Promise<void> {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const { world, resources, metadata, TargetComponentConstructor, notifications } = context;
   const { component_updates, component_last_write_tick, world_tick } = resources;
   const { target_type } = metadata;

   const relationship_component_name = relationship_component_removed.constructor.name;
   const former_target_id = relationship_component_removed.target_entity_id;

   const should_notify_set_event = !is_overwrite
      && world.entity_is_alive(source_entity_id)
      && notifications.relationship_set_event_name;

   if (!world.entity_is_alive(former_target_id)) {
      logger.trace(`entity ${source_entity_id}: target ${former_target_id} for removed ${relationship_component_name} no longer exists`);

      if (should_notify_set_event) {
         await world.notify(
            notifications.relationship_set_event_name!,
            //
            source_entity_id,
            undefined,
            former_target_id
         );
      }

      return;
   }

   const target_side_comp = world.component_get_from_name<RelationshipTargetBase>(former_target_id, target_type);

   if (
      target_side_comp
      && target_side_comp.source_entities.has(source_entity_id)
   ) {
      target_side_comp.source_entities.delete(source_entity_id);

      const target_comp_updates_map = component_updates.data.get(target_type);

      if (target_comp_updates_map) {
         const cloned_target_comp = new TargetComponentConstructor({
            source_entities: target_side_comp.source_entities
         });

         target_comp_updates_map.set(former_target_id, cloned_target_comp);
         component_last_write_tick.data.set(target_type, world_tick.data);
      } else {
         logger.warn(`entity ${former_target_id}: component_updates resource missing for ${target_type}`);
      }

      logger.trace(`entity ${former_target_id}: removed source ${source_entity_id} from ${target_type}. remaining: ${target_side_comp.source_entities.size}`);

      if (notifications.source_removed_from_target_event_name) {
         await world.notify(
            notifications.source_removed_from_target_event_name,
            //
            former_target_id,
            source_entity_id
         );
      }

      if (should_notify_set_event) {
         await world.notify(
            notifications.relationship_set_event_name!,
            //
            source_entity_id,
            undefined,
            former_target_id
         );
      }

      if (target_side_comp.source_entities.size === 0) {
         logger.trace(`entity ${former_target_id}: ${target_type} is empty, removing`);

         await world.component_remove_multiple_direct(former_target_id, [target_type]);
      }
   } else if (should_notify_set_event) {
      if (target_side_comp) {
         logger.trace(`entity ${former_target_id}: source ${source_entity_id} not found in ${target_type}`);
      } else {
         logger.trace(`entity ${former_target_id}: ${target_type} not found during removal of ${relationship_component_name} from ${source_entity_id}`);
      }

      await world.notify(
         notifications.relationship_set_event_name!,
         //
         source_entity_id,
         undefined,
         former_target_id
      );
   }
}