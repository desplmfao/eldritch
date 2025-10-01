/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/world.ts
 */

import { default_logger, Logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@self/types/world';
import type { IWorldStorageBackend } from '@self/types/world_storage_backend';

import type { IStorage } from '@self/types/storage';
import type { EntityId, EntitySpawnDefinition } from '@self/types/entity';
import type { Event, EventArgs } from '@self/types/event';
import type { Plugin, PluginConstructor } from '@self/types/plugin';
import type { WorldEventHandler } from '@self/types/event_handler';
import type { Component, ComponentConstructor, ComponentDependencies, ComponentDefinition } from '@self/types/component';
import { Schedule } from '@self/types/schedule';

import { ResourceCommandBuffer } from '@self/ecs/resources/command_buffer';
import { ResourceRelationshipRegistry } from '@self/ecs/resources/relationship';
import { ResourceLoopControl } from '@self/ecs/resources/loop_control';
import { ResourceReflectionMap } from '@self/ecs/resources/reflection';

import {
   ResourceCheckDependsComponent,
   ResourceCheckDependsSystem,
   ResourceComponentEntities,
   ResourceComponentLastWriteTick,
   ResourceComponentUpdates,
   ResourceDeltaTimeLogical,
   ResourceDeltaTimeLogicalReal,
   ResourceDeltaTimeRender,
   ResourceDeltaTimeRenderReal,
   ResourceEntitiesDeleted,
   ResourceSystemLastWriteTick,
   ResourceWorldTick
} from '@self/ecs/resources/core';

import {
   add_plugin,
   add_plugins
} from '@self/operations/plugin';

import {
   scheduler_cleanup,
   scheduler_initialize,
   scheduler_run,
   scheduler_stop,
   scheduler_update
} from '@self/operations/scheduler';

import { entity_id_iterator } from '@self/entity';

import { Observer } from '@self/observer';
import { Storage } from '@self/storage';
import { MasterScheduler } from '@self/scheduler_master';

export class World implements IWorld {
   initialized: boolean = false;

   id_generator = entity_id_iterator();

   storage: IStorage;
   master_scheduler: MasterScheduler;
   plugins: Map<PluginConstructor, Plugin>;
   observer: Observer;

   storage_backend: IWorldStorageBackend;

   z$_resource_reflection_map: ResourceReflectionMap;
   z$_resource_command_buffer: ResourceCommandBuffer;
   z$_resource_relationship_registry: ResourceRelationshipRegistry;
   z$_resource_deleted_entities: ResourceEntitiesDeleted;
   z$_resource_component_entities: ResourceComponentEntities;
   z$_resource_component_updates: ResourceComponentUpdates;
   z$_resource_component_last_write_tick: ResourceComponentLastWriteTick;
   z$_resource_system_last_write_tick: ResourceSystemLastWriteTick;
   z$_resource_world_tick: ResourceWorldTick;
   z$_resource_loop_control: ResourceLoopControl;
   z$_resource_delta_time_logical: ResourceDeltaTimeLogical;
   z$_resource_delta_time_logical_real: ResourceDeltaTimeLogicalReal;
   z$_resource_delta_time_render: ResourceDeltaTimeRender;
   z$_resource_delta_time_render_real: ResourceDeltaTimeRenderReal;

   constructor(
      options: {
         /** */
         storage_backend: IWorldStorageBackend,
         /** custom id generator for entities */
         id_generator?: IterableIterator<EntityId>;
         /** */
         logger_options?: Logger['options'];
      }
   ) {
      this.storage = new Storage();
      this.plugins = new Map();

      this.storage_backend = options.storage_backend;

      if (options?.logger_options) {
         default_logger.options = {
            ...default_logger.options,
            ...options.logger_options
         }
      }

      const logger = default_logger.get_namespaced_logger('<namespace>');

      logger.trace('initializing world...');

      if (options?.id_generator) {
         this.id_generator = options.id_generator;
      }

      this.storage.set(ResourceCheckDependsComponent, new ResourceCheckDependsComponent());
      this.storage.set(ResourceCheckDependsSystem, new ResourceCheckDependsSystem());

      this.storage.set(ResourceLoopControl, new ResourceLoopControl());
      this.z$_resource_loop_control = this.storage.get(ResourceLoopControl)!;

      this.storage.set(ResourceDeltaTimeLogical, new ResourceDeltaTimeLogical());
      this.z$_resource_delta_time_logical = this.storage.get(ResourceDeltaTimeLogical)!;

      this.storage.set(ResourceDeltaTimeLogicalReal, new ResourceDeltaTimeLogicalReal());
      this.z$_resource_delta_time_logical_real = this.storage.get(ResourceDeltaTimeLogicalReal)!;

      this.storage.set(ResourceDeltaTimeRender, new ResourceDeltaTimeRender());
      this.z$_resource_delta_time_render = this.storage.get(ResourceDeltaTimeRender)!;

      this.storage.set(ResourceDeltaTimeRenderReal, new ResourceDeltaTimeRenderReal());
      this.z$_resource_delta_time_render_real = this.storage.get(ResourceDeltaTimeRenderReal)!;

      this.storage.set(ResourceCommandBuffer, new ResourceCommandBuffer());
      this.z$_resource_command_buffer = this.storage.get(ResourceCommandBuffer)!;

      this.storage.set(ResourceRelationshipRegistry, new ResourceRelationshipRegistry());
      this.z$_resource_relationship_registry = this.storage.get(ResourceRelationshipRegistry)!;

      this.storage.set(ResourceEntitiesDeleted, new ResourceEntitiesDeleted());
      this.z$_resource_deleted_entities = this.storage.get(ResourceEntitiesDeleted)!;

      this.storage.set(ResourceComponentEntities, new ResourceComponentEntities());
      this.z$_resource_component_entities = this.storage.get(ResourceComponentEntities)!;

      this.storage.set(ResourceComponentUpdates, new ResourceComponentUpdates());
      this.z$_resource_component_updates = this.storage.get(ResourceComponentUpdates)!;

      this.storage.set(ResourceComponentLastWriteTick, new ResourceComponentLastWriteTick());
      this.z$_resource_component_last_write_tick = this.storage.get(ResourceComponentLastWriteTick)!;

      this.storage.set(ResourceSystemLastWriteTick, new ResourceSystemLastWriteTick());
      this.z$_resource_system_last_write_tick = this.storage.get(ResourceSystemLastWriteTick)!;

      this.storage.set(ResourceWorldTick, new ResourceWorldTick());
      this.z$_resource_world_tick = this.storage.get(ResourceWorldTick)!;

      this.storage.set(ResourceReflectionMap, new ResourceReflectionMap());
      this.z$_resource_reflection_map = this.storage.get(ResourceReflectionMap)!;

      this.master_scheduler = new MasterScheduler(this);

      this.storage_backend.initialize?.(this);

      this.observer = new Observer(this);

      logger.trace('world initialized successfully');

      /// #if DEBUG
      default_logger.test_self();
      /// #endif
   }

   //
   //

   async add_plugin(
      plugin: Plugin
   ) {
      return await add_plugin(
         this,
         //
         this.z$_resource_reflection_map,
         //
         plugin
      );
   }

   async add_plugins(
      plugins_tuple: (Plugin | Plugin[])[]
   ) {
      return await add_plugins(
         this,
         //
         plugins_tuple
      );
   }

   //
   //

   async subscribe<E extends Event>(
      event: E,
      handler_instance: WorldEventHandler<E>
   ) {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      logger.trace(`subscribing handler '${handler_instance.constructor.name}' to event '${event}'`);

      return await this.observer.subscribe(event, handler_instance);
   }

   async unsubscribe<E extends Event>(
      event: E,
      index: number
   ) {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      logger.trace(`removing subscription from event: '${event}' with index ${index}`);

      return await this.observer.unsubscribe(event, index);
   }

   async notify<E extends Event>(
      event: E,
      ...args: EventArgs[E]
   ) {
      return await this.observer.notify(event, ...args);
   }

   //
   //

   entity_spawn_defer(
      definition: EntitySpawnDefinition
   ) {
      return this.storage_backend.entity_spawn_defer(
         definition
      );
   }

   async entity_spawn_direct(
      definition: EntitySpawnDefinition,
      parent_id?: EntityId
   ) {
      return await this.storage_backend.entity_spawn_direct(
         definition,
         parent_id
      );
   }

   async entity_create_direct() {
      return await this.storage_backend.entity_create_direct();
   }

   entity_delete_defer(
      entity: EntityId
   ) {
      return this.storage_backend.entity_delete_defer(
         entity
      );
   }

   async entity_delete_multiple_direct(
      entities_to_delete: EntityId[]
   ) {
      return await this.storage_backend.entity_delete_multiple_direct(
         entities_to_delete
      )
   }

   async entity_delete_direct(
      entity_id: EntityId,
      visited_during_delete: Set<EntityId> = new Set()
   ) {
      return await this.storage_backend.entity_delete_direct(
         entity_id,
         visited_during_delete
      );
   }

   entity_find_direct(
      component_names: string[]
   ) {
      return this.storage_backend.entity_find_direct(
         component_names
      );
   }

   entity_find_multiple_direct(
      component_names: string[]
   ) {
      return this.storage_backend.entity_find_multiple_direct(
         component_names
      )
   }

   entity_is_alive(
      entity_id: EntityId
   ) {
      return this.storage_backend.entity_is_alive(
         entity_id
      );
   }

   entity_parent_get(
      child_id: EntityId
   ) {
      return this.storage_backend.entity_parent_get(
         child_id
      );
   }

   entity_children_get(
      parent_id: EntityId
   ) {
      return this.storage_backend.entity_children_get(
         parent_id
      );
   }

   async entity_parent_set_direct(
      child_id: EntityId,
      parent_id?: EntityId
   ) {
      return await this.storage_backend.entity_parent_set_direct(
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
      yield* this.storage_backend.entity_view(
         options
      );
   }

   //
   //

   component_has(
      entity_id: EntityId,
      component_name: string
   ) {
      return this.storage_backend.component_has(
         entity_id,
         component_name
      );
   }

   component_has_multiple(
      entity_id: EntityId,
      component_names: string[]
   ) {
      return this.storage_backend.component_has_multiple(
         entity_id,
         component_names
      );
   }

   component_get<C extends ComponentConstructor>(
      entity_id: EntityId,
      component_ctor: C
   ): InstanceType<C> | undefined {
      return this.storage_backend.component_get<InstanceType<C>>(
         entity_id,
         component_ctor.name
      );
   }

   component_get_from_name<C extends Component>(
      entity_id: EntityId,
      component_name: string
   ): C | undefined {
      return this.storage_backend.component_get<C>(
         entity_id,
         component_name
      );
   }

   component_get_multiple<CC extends ComponentConstructor[]>(
      entity_id: EntityId,
      component_ctors: [...CC]
   ): {
         [K in keyof CC]: InstanceType<CC[K]> | undefined
      } {
      const names = component_ctors.map(c => c.name);

      return this.storage_backend.component_get_multiple<{
         [K in keyof CC]: InstanceType<CC[K]>
      }>(
         entity_id,
         names
      );
   }

   component_get_from_name_multiple<CC extends Component[]>(
      entity_id: EntityId,
      component_names: string[]
   ): {
         [K in keyof CC]: CC[K] | undefined
      } {
      return this.storage_backend.component_get_multiple(
         entity_id,
         component_names
      ) as CC;
   }

   component_add_multiple_defer(
      entity: EntityId,
      component_definitions: ComponentDefinition[]
   ) {
      return this.storage_backend.component_add_multiple_defer(
         entity,
         component_definitions
      );
   }

   async component_add_multiple_direct(
      entity: EntityId,
      component_definitions: ComponentDefinition[]
   ) {
      return this.storage_backend.component_add_multiple_direct(
         entity,
         component_definitions
      );
   }

   component_remove_multiple_defer(
      entity: EntityId,
      names: string[]
   ) {
      return this.storage_backend.component_remove_multiple_defer(
         entity,
         names
      )
   }

   async component_remove_multiple_direct(
      entity: EntityId,
      component_names_to_remove: string[],
   ) {
      return this.storage_backend.component_remove_multiple_direct(
         entity,
         component_names_to_remove
      );
   }

   component_validate_dependencies(
      final_names: Set<string>,
      dependencies?: ComponentDependencies,
      entity_id?: EntityId
   ) {
      return this.storage_backend.component_validate_dependencies(
         final_names,
         dependencies,
         entity_id
      );
   }

   component_is_registered(
      name: string
   ) {
      return this.storage_backend.component_is_registered(
         name
      );
   }

   component_get_all<CC extends ComponentConstructor[]>(
      entity_id: EntityId
   ): {
         [K in keyof CC]: InstanceType<CC[K]> | undefined
      } {
      return this.storage_backend.component_get_all<CC>(
         entity_id
      );
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
      yield* this.storage_backend.component_view(
         component_names,
         options
      );
   }

   //
   //

   async initialize() {
      return scheduler_initialize(
         this
      );
   }

   async update(
      schedule: Schedule,
      delta_time?: number
   ) {
      return scheduler_update(
         this,
         //
         this.z$_resource_reflection_map,
         this.z$_resource_system_last_write_tick,
         this.z$_resource_component_last_write_tick,
         this.z$_resource_world_tick,
         this.z$_resource_delta_time_logical,
         this.z$_resource_delta_time_render,
         // 
         schedule,
         delta_time
      );
   }

   async run() {
      return await scheduler_run(
         this,
         //
         this.storage.get(ResourceLoopControl)!
      );
   }

   async stop() {
      return await scheduler_stop(
         this.storage.get(ResourceLoopControl)!
      );
   }

   async cleanup() {
      return scheduler_cleanup(
         this
      );
   }
}