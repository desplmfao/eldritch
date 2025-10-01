/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/types/world.ts
 */

import type { Observer } from '@self/observer';
import type { MasterScheduler } from '@self/scheduler_master';

import type { IWorldStorageBackend } from '@self/types/world_storage_backend';

import type { IStorage } from '@self/types/storage';
import type { Schedule } from '@self/types/schedule';
import type { EntityId, EntitySpawnDefinition } from '@self/types/entity';
import type { Event, EventArgs } from '@self/types/event';
import type { Plugin, PluginConstructor } from '@self/types/plugin';
import type { WorldEventHandler } from '@self/types/event_handler';
import type { Component, ComponentConstructor, ComponentDependencies, ComponentDefinition } from '@self/types/component';

export interface IWorld {
   initialized: boolean;

   readonly id_generator: IterableIterator<EntityId>;

   readonly master_scheduler: MasterScheduler;
   readonly plugins: Map<PluginConstructor, Plugin>;
   readonly observer: Observer;
   readonly storage: IStorage;

   readonly storage_backend: IWorldStorageBackend;

   //
   //

   /**
    * adds a plugin to the world
    *
    * checks dependencies and calls the plugin's `build` method
    *
    * plugins are built immediately upon being added
    *
    * @param plugin - an instance of the plugin to add
    *
    * @throws if a required dependency plugin is missing or if the plugin's `build` method throws an error
    */
   add_plugin(
      plugin: Plugin
   ): Promise<boolean>;

   /**
    * adds multiple plugins to the world sequentially
    * 
    * stops adding plugins if any single plugin fails to add or build
    *
    * @param plugins - an array of plugin instances to add
    * 
    * @throws if any plugin fails to add (see {@link add_plugin})
    */
   add_plugins(
      plugins: Plugin[]
   ): Promise<void>;

   //
   //

   /**
    * subscribes an event handler instance to an event
    *
    * @template E - the type of the event to subscribe to
    * 
    * @param event the event to subscribe to
    * @param handler_instance an instance of a class extending `WorldEventHandler<E>`
    * 
    * @returns a unique index for this subscription, used for unsubscribing
    */
   subscribe<E extends Event>(
      event: E,
      handler_instance: WorldEventHandler<E>
   ): Promise<number>;

   /**
    * unsubscribes a previously registered event handler using its subscription 
    * 
    * @template E - the type of the event the handler was subscribed to
    *
    * @param event the event the handler was subscribed to
    * @param index the unique index returned by the `subscribe` method
    */
   unsubscribe<E extends Event>(
      event: E,
      index: number
   ): Promise<void>;

   /**
    * notifies all subscribed handlers for a given event, passing along event-specific arguments
    * 
    * @template E - the type of the event to notify
    *
    * @param event the event identifier
    * @param args the arguments specific to this event type
    */
   notify<E extends Event>(
      event: E,
      ...args: EventArgs[E]
   ): Promise<void>;

   //
   //

   /**
    * defers spawning an entity and its entire hierarchy from a single recursive definition
    *
    * @param definition a recursive `EntitySpawnDefinition` object describing the entity and its children
    */
   entity_spawn_defer(definition: EntitySpawnDefinition): void;

   /**
    * **only call this during initialization schedules or outside the main game loop** 
    *
    * creates an entity and its entire hierarchy from a single recursive definition immediately, bypassing the command buffer
    *
    * calling during `Update` or `FixedUpdate` can lead to inconsistencies. use `entity_spawn_defer` for spawning during the main loop
    *
    * @param definition a recursive `EntitySpawnDefinition` object describing the entity and its children
    * 
    * @returns the `EntityId` of the root entity spawned from the definition
    */
   entity_spawn_direct(
      definition: EntitySpawnDefinition,
      parent_id?: EntityId
   ): Promise<EntityId>;

   /**
    * creates an entity immediately, bypassing the command buffer
    *
    * updates the entity's archetype and notifies the 'entity_created' event
    * 
    * intended for setup phases or specific internal use cases. use `defer_create_entity` within systems
    *
    * use `defer_create_entity` within systems during updates
    */
   entity_create_direct(): Promise<EntityId>;

   /** */
   entity_delete_defer(
      entity: EntityId
   ): void;

   /**
    * deletes multiple entities immediately, bypassing the command buffer
    * 
    * handles archetype removal, component cleanup, relationship updates (if applicable), and notifies 'entity_deleted' for each successfully deleted entity
    * 
    * includes recursive deletion for children if the parent-child relationship is configured with `linked_spawn: true`
    *
    * use `entity_delete_defer` within systems during updates
    * 
    * @param entities_to_delete - an array of entity ids to delete
    */
   entity_delete_multiple_direct(
      entities_to_delete: EntityId[]
   ): Promise<Map<EntityId, boolean>>;

   /**
    * deletes a single entity immediately, bypassing the command buffer
    * 
    * handles archetype removal, component cleanup, relationship updates (if applicable), and notifies 'entity_deleted'
    * 
    * includes recursive deletion for children if the parent-child relationship is configured with `linked_spawn: true`
    *
    * use `entity_delete_defer` within systems during updates
    * 
    * @param entity_id - the id of the entity to delete
    * @param visited_during_delete - (internal) used to detect cycles during recursive deletion
    */
   entity_delete_direct(
      entity_id: EntityId,
      visited_during_delete?: Set<EntityId>
   ): Promise<boolean>;

   /**
    * finds the id of the *first* entity that has *all* the specified components
    * 
    * checks archetypes for efficiency
    *
    * @param component_names - an array of component names required
    */
   entity_find_direct(
      component_names: string[]
   ): EntityId | undefined;

   /**
    * finds the ids of *all* entities that have *all* the specified components
    *
    * @param component_names - an array of component names required
    */
   entity_find_multiple_direct(
      component_names: string[]
   ): Set<EntityId>;

   /** */
   entity_is_alive(
      entity_id: EntityId
   ): boolean;

   /**
    * gets the parent entity id of a given child entity, if it has one (via `ComponentChildOf`)
    *
    * @param child_id - the id of the child entity
    */
   entity_parent_get(
      child_id: EntityId
   ): EntityId | undefined;

   /**
    * gets an array of direct child entity ids for a given parent entity (via `ComponentChildren`)
    *
    * @param parent_id - the id of the parent entity
    */
   entity_children_get(
      parent_id: EntityId
   ): EntityId[];

   /**
    * sets the parent of an entity immediately, bypassing the command buffer
    * 
    * adds/updates `ComponentChildOf` on the child. triggers events that cause `ComponentChildren` on parents to be updated automatically by event handlers
    *
    * use deferred commands or manage relationships via component add/remove within systems
    * 
    * @param child_id - the id of the entity to set the parent for
    * @param parent_id - the id of the new parent entity, or nothing to remove the parent
    */
   entity_parent_set_direct(
      child_id: EntityId,
      parent_id?: EntityId
   ): Promise<boolean>;

   /**
    * creates a 'view' of entity ids that possess a specific set of components, optionally filtering further based on the presence or absence of other components
    *
    * this is a more performant alternative to `component_view` when you only need to know which entities match, without needing their component data
    * 
    * @param options - optional filters for components that must be present (`with`) or must be absent (`without`)
    */
   entity_view(
      options?: {
         with?: string[];
         without?: string[];
      }
   ): AsyncIterableIterator<EntityId>;

   //
   //

   /**
    * checks if an entity has a specific component
    *
    * @param entity_id - the id of the entity
    * @param component_name - the name of the component to check for
    */
   component_has(
      entity_id: EntityId,
      component_name: string
   ): boolean;

   /**
    * checks if an entity has a specific components
    *
    * @param entity_id - the id of the entity
    * @param component_names - the names of the components to check for
    */
   component_has_multiple(
      entity_id: EntityId,
      component_names: string[]
   ): boolean[];

   /**
    * retrieves a single component instance for a given entity, if it exists and the entity is alive
    *
    * @template C - the type of the component
    *
    * @param entity_id - the id of the entity
    * @param component_ctor - the constructor of the component to retrieve
    */
   component_get<C extends ComponentConstructor>(
      entity_id: EntityId,
      component_ctor: C
   ): InstanceType<C> | undefined;

   /**
    * retrieves a single component instance for a given entity, if it exists and the entity is alive
    *
    * @template C - the type of the component
    *
    * @param entity_id - the id of the entity
    * @param component_name - the name of the component to retrieve
    */
   component_get_from_name<C extends Component>(
      entity_id: EntityId,
      component_name: string
   ): C | undefined;

   /**
    * retrieves multiple specific component instances for a given entity
    *
    * @template CC - a tuple of Component constructors
    * 
    * @param entity_id - the id of the entity
    * @param component_ctors - an array of component constructors to retrieve
    * 
    * @returns an array with the same length and order as the requested components, containing the component instance or nothing if the entity doesn't have it
    */
   component_get_multiple<CC extends ComponentConstructor[]>(
      entity_id: EntityId,
      component_ctors: [...CC]
   ): {
         [K in keyof CC]: InstanceType<CC[K]> | undefined
      };

   /**
    * retrieves multiple specific component instances for a given entity
    *
    * @template CC - a tuple of Component constructors
    * 
    * @param entity_id - the id of the entity
    * @param component_names - an array of component names to retrieve
    * 
    * @returns an array with the same length and order as the requested components, containing the component instance or nothing if the entity doesn't have it
    */
   component_get_from_name_multiple<CC extends Component[]>(
      entity_id: EntityId,
      component_names: string[]
   ): {
         [K in keyof CC]: CC[K] | undefined
      };

   component_add_multiple_defer(
      entity: EntityId,
      component_definitions: ComponentDefinition[]
   ): void;

   /**
    * adds components to an entity immediately, bypassing the command buffer
    * 
    * validates component dependencies, updates the entity's archetype, stores component state for change detection, and notifies 'component_added'
    * 
    * if a component of the same type already exists, it will be overwritten, triggering 'component_removed' for the old instance before 'component_added' for the new one
    * 
    * relationship components (`ComponentChildOf` etc.) trigger automatic updates on the target entity
    *
    * use `component_add_multiple_defer` within systems during updates
    * 
    * @param entity - the target entity id
    * @param component_definitions - an array of component definitions to add
    * 
    * @throws if dependency validation fails
    */
   component_add_multiple_direct(
      entity: EntityId,
      component_definitions: ComponentDefinition[]
   ): Promise<boolean>;

   /** */
   component_remove_multiple_defer(
      entity: EntityId,
      names: string[]
   ): void;

   /**
    * removes components from an entity immediately, bypassing the command buffer
    * 
    * validates that no *remaining* components depend on the ones being removed
    * updates the entity's archetype, removes component state from change tracking, and notifies 'component_removed' for each successfully removed component instance
    * 
    * removing relationship components triggers automatic updates on the target entity
    *
    * use `component_remove_multiple_defer` within systems during updates
    * 
    * @param entity - the target entity id
    * @param component_names_to_remove - an array of component names to remove
    * 
    * @throws if a remaining component depends on a component being removed
    */
   component_remove_multiple_direct(
      entity: EntityId,
      component_names_to_remove: string[],
   ): Promise<boolean>;

   /** */
   component_validate_dependencies(
      final_names: Set<string>,
      dependencies?: ComponentDependencies,
      entity_id?: EntityId
   ): void;

   /**
    * checks if a component type (identified by its name) has been added to *any* active entity in the world
    *
    * @param name - the component name to check
    */
   component_is_registered(
      name: string
   ): boolean;

   /**
    * retrieves all component instances for a given entity
    *
    * @param entity_id the id of the entity
    */
   component_get_all<CC extends ComponentConstructor[]>(
      entity_id: EntityId
   ): {
         [K in keyof CC]: InstanceType<CC[K]> | undefined
      };

   /**
    * creates a 'view' of entities that possess a specific set of components, optionally filtering further based on the presence or absence of other components
    *
    * leverages archetypes and query caching for performance
    *
    * yields tuples of `[EntityId, [ComponentA, ComponentB, ...]]`, providing direct access to the requested component instances
    *
    * @template CC - an array tuple type representing the required component names
    *
    * @param component_names - an array of component names to query for
    * @param options - optional filters for components that must also be present (`with`) or must be absent (`without`)
    */
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

   /**
    * initializes the world and its systems
    * 
    * calls the `initialize` method on all unique registered systems within each plugin's scheduler
    *
    * @throws if any system initialization returns `false` or throws an error
    */
   initialize(): Promise<boolean>;

   /**
    * runs all systems registered for the given schedule
    * 
    * processes pending system additions/removals before execution
    * 
    * updates relevant delta time resources (`DELTA_TIME_LOGICAL` or `DELTA_TIME_RENDER`)
    * 
    * calls plugin lifecycle hooks (`pre_startup`, `post_startup`) if the schedule matches
    *
    * @param schedule - the schedule enum value to run
    * @param delta_time - the time elapsed since the last update for this schedule type (in seconds). defaults to -1 if not provided
    */
   update(
      schedule: Schedule,
      delta_time?: number
   ): Promise<void>;

   /** runs the entire ecs loop */
   run(): Promise<void>;

   /** stops the entire ecs loop */
   stop(): Promise<void>;

   /**
    * cleans up the world, its systems, and plugins
    * 
    * calls the `cleanup` method on all unique registered systems within each plugin's scheduler
    * 
    * calls the `remove` hook on all registered plugins
    * 
    * clears internal storage, observer subscriptions, and plugin registry
    */
   cleanup(): Promise<boolean>;
}