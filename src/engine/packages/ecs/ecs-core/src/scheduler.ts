/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/scheduler.ts
 */

import { get_metadata } from '@eldritch-engine/reflect/index';
import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@self/types/world';
import type { Plugin } from '@self/types/plugin';
import type { SystemEntry, System, SystemDependencies } from '@self/types/system';
import { Schedule } from '@self/types/schedule';

import { ResourceCheckDependsComponent } from '@self/ecs/resources/core';
import { ResourceReflectionMap } from '@self/ecs/resources/reflection';

import { METHOD_METADATA_KEY, resolve_and_execute } from '@self/reflect/index';

export class Scheduler {
   #world: IWorld;
   #owner_plugin: Plugin;

   pending_additions: Map<
      System,
      {
         schedules: Schedule[];
         order: number;
      }
   > = new Map();

   pending_removals: Set<System> = new Set();
   systems_by_schedule: Map<Schedule, Set<SystemEntry>> = new Map();

   initialized_systems: Set<System> = new Set();
   cleaned_up_systems: Set<System> = new Set();

   z$_resource_check_dependencies_component: ResourceCheckDependsComponent;
   z$_resource_reflection_map: ResourceReflectionMap;

   constructor(
      world: IWorld,
      owner_plugin: Plugin
   ) {
      this.#world = world;
      this.#owner_plugin = owner_plugin;

      this.z$_resource_check_dependencies_component = this.#world.storage.get(ResourceCheckDependsComponent)!;
      this.z$_resource_reflection_map = this.#world.storage.get(ResourceReflectionMap)!;
   }

   /** gets an active or pending system instance by its class type */
   system_get<S extends System>(
      system_type: new (...args: unknown[]) => S
   ): S {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      logger.trace(`searching for system type: ${system_type.name}`);

      for (const schedule_systems of this.systems_by_schedule.values()) {
         for (const { system } of schedule_systems) {
            if (system instanceof system_type) {
               return system;
            }
         }
      }

      for (const system of this.pending_additions.keys()) {
         if (system instanceof system_type) {
            logger.trace(`found system type ${system_type.name} in pending additions`);

            return system;
         }
      }

      /// #if SAFETY
      {
         const message = `system of type '${system_type.name}' not found in scheduler`;

         logger.critical(message);
         throw new Error(message);
      }
      /// #endif
   }

   /** gets all currently active system entries grouped by schedule */
   get_active_systems_by_schedule(): Map<Schedule, Set<SystemEntry>> {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      logger.trace('retrieving active systems');

      this.process_pending_systems_internal();

      return this.systems_by_schedule;
   }

   get_active_systems_for_schedule_phase(
      schedule: Schedule
   ): SystemEntry[] {
      this.process_pending_systems_internal();

      const entries = this.systems_by_schedule.get(schedule);

      return entries ? [...entries] : [];
   }

   async system_add_multiple(
      systems: [
         schedules: Schedule | Schedule[],
         system: System
      ][]
   ): Promise<void> {
      for await (const [schedules, system] of systems) {
         await this.system_add(schedules, system);
      }
   }

   /**
    * schedules a system to be added during the next processing phase
    *
    * @throws if the system is missing required properties or dependencies are not met
    */
   async system_add(
      schedules: Schedule | Schedule[],
      system: System,
   ): Promise<boolean> {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      const name = system.constructor.name;
      const system_schedules = Array.isArray(schedules) ? schedules : [schedules];

      /// #if LOGGER_HAS_TRACE
      const schedule_names = system_schedules
         .map((s) => Schedule[s])
         .join(', ');

      logger.trace(`scheduling system '${name}' for addition to schedules: [${schedule_names}]`);
      /// #endif

      /// #if SAFETY
      if (!system.dependencies) {
         {
            const message = `cannot add system '${name}': missing required 'dependencies' property`;

            logger.critical(message);
            throw new Error(message);
         }
      } else if (!(system_schedules.length > 0)) {
         {
            const message = `cannot add system '${name}': no target schedules provided`;

            logger.critical(message);
            throw new Error(message);
         }
      }
      /// #endif

      logger.trace(`validating dependencies for system '${name}'`);

      this.validate_dependencies(name, system.dependencies);

      this.pending_additions.set(
         system,
         {
            schedules: system_schedules,
            order: system.order ?? 0
         }
      );

      if (this.pending_removals.has(system)) {
         this.pending_removals.delete(system);
      }

      this.#world.master_scheduler.register_system(this.#owner_plugin, system, system_schedules);

      await this.#world.notify('system_created', system);

      return true;
   }

   /** schedules a system for removal during the next processing phase */
   async system_remove(
      system: System
   ) {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      if (this.pending_additions.has(system)) {
         this.pending_additions.delete(system);
         this.#world.master_scheduler.unregister_system(this.#owner_plugin, system);

         await this.#world.notify('system_stopped', system);

         return;
      }

      let exists_in_this_plugin = false;

      for (const schedule_set of this.systems_by_schedule.values()) {
         if ([...schedule_set].some(entry => entry.system === system)) {
            exists_in_this_plugin = true;

            break;
         }
      }

      /// #if SAFETY
      if (
         !exists_in_this_plugin
         && !this.pending_removals.has(system)
      ) {
         logger.warn(`attempted to remove system '${system.constructor.name}' from plugin '${this.#owner_plugin.constructor.name}', but it was not found as a pending or active system`);
      }
      /// #endif

      if (
         exists_in_this_plugin
         && !this.pending_removals.has(system)
      ) {
         this.pending_removals.add(system);

         this.#world.master_scheduler.unregister_system(this.#owner_plugin, system);

         await this.#world.notify('system_stopped', system);
      }
   }

   get_all_unique_systems(): Set<System> {
      const unique_systems = new Set<System>();

      for (const schedule_systems of this.systems_by_schedule.values()) {
         for (const { system } of schedule_systems) {
            unique_systems.add(system);
         }
      }

      for (const system of this.pending_additions.keys()) {
         unique_systems.add(system);
      }

      return unique_systems;
   }

   async process_pending_systems_internal() {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      let structure_changed = false;

      // TODO: add the logic for the added and removed names for the trace logs

      /// #if LOGGER_HAS_TRACE
      if (
         this.pending_additions.size > 0 ||
         this.pending_removals.size > 0
      ) {
         logger.trace(`processing pending systems. removals: ${this.pending_removals.size}, additions: ${this.pending_additions.size}`);
      }

      const added_system_names = new Set<string>();
      const removed_system_names = new Set<string>();
      /// #endif

      if (this.pending_removals.size > 0) {
         for (const system_to_remove of this.pending_removals) {
            for (const schedule_systems of this.systems_by_schedule.values()) {
               const initial_size = schedule_systems.size;
               const filtered = new Set([...schedule_systems].filter(e => e.system !== system_to_remove));

               if (filtered.size < initial_size) {
                  const schedule_key = [...this.systems_by_schedule.entries()].find(entry => entry[1] === schedule_systems)?.[0];

                  if (schedule_key != null) {
                     this.systems_by_schedule.set(schedule_key, filtered);
                  }
               }
            }
         }

         this.pending_removals.clear();
      }

      if (this.pending_additions.size > 0) {
         for (const [system, { schedules, order }] of this.pending_additions) {
            for (const schedule of schedules) {
               if (!this.systems_by_schedule.has(schedule)) {
                  this.systems_by_schedule.set(schedule, new Set());
               }

               const schedule_systems = this.systems_by_schedule.get(schedule)!;

               if (![...schedule_systems].some(e => e.system === system)) {
                  schedule_systems.add({ system, order });

                  const sorted_entries = [...schedule_systems].sort((a, b) => a.order - b.order);
                  this.systems_by_schedule.set(schedule, new Set(sorted_entries));
               }
            }
         }

         this.pending_additions.clear();
      }

      /// #if LOGGER_HAS_TRACE
      if (structure_changed) {
         const removed_names = [...removed_system_names].join(', ');
         const added_names = [...added_system_names].join(', ');

         if (removed_system_names.size > 0) {
            logger.trace(`system schedule structure updated due to removal of: ${removed_system_names.size === 1 ? removed_names : `[${removed_names}]`}`);
         }

         if (added_system_names.size > 0) {
            logger.trace(`system schedule structure updated due to addition of: ${added_system_names.size === 1 ? added_names : `[${added_names}]`}`);
         }
      }
      /// #endif
   }

   async initialize_system_internal(
      world: IWorld,
      //
      system: System
   ): Promise<void> {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      if (this.initialized_systems.has(system)) {
         return;
      }

      try {
         let result: boolean | void = true;

         if (system.initialize) {
            if (get_metadata(METHOD_METADATA_KEY, system, 'initialize')) {
               result = await resolve_and_execute(world, this.z$_resource_reflection_map, system, 'initialize', [world]) as boolean;
            } else {
               result = await system.initialize(world);
            }
         }

         if (result === false) {
            {
               const message = `system '${system.constructor.name}' in plugin '${this.#owner_plugin.constructor.name}' returned false on initialize`;

               logger.critical(message);
               throw new Error(message);
            }
         }

         this.initialized_systems.add(system);

         await this.#world.notify('system_initialized', system);
      } catch (e) {
         {
            const message = `error initializing system '${system.constructor.name}' in plugin '${this.#owner_plugin.constructor.name}': ${e.message}`;

            logger.critical(message);
            throw new Error(message, { cause: e });
         }
      }
   }

   async cleanup_system_internal(
      world: IWorld,
      system: System
   ): Promise<void> {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      if (this.cleaned_up_systems.has(system)) {
         return;
      }

      try {
         if (system.cleanup) {
            if (get_metadata(METHOD_METADATA_KEY, system, 'cleanup')) {
               await resolve_and_execute(world, this.z$_resource_reflection_map, system, 'cleanup', [world]);
            } else {
               await system.cleanup(world);
            }
         }

         this.cleaned_up_systems.add(system);
         this.initialized_systems.delete(system);

         await this.#world.notify('system_cleaned', system);
      } catch (e) {
         {
            const message = `error cleaning up system '${system.constructor.name}' in plugin '${this.#owner_plugin.constructor.name}': ${e.message}`;

            logger.critical(message);
            throw new Error(message, { cause: e });
         }
      }
   }

   has_system(
      target_name: string
   ): boolean {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      logger.trace(`checking existence of system type: ${target_name}`);

      for (const schedule_systems of this.systems_by_schedule.values()) {
         for (const { system } of schedule_systems) {
            if (system.constructor.name === target_name) {
               return true;
            }
         }
      }

      for (const system of this.pending_additions.keys()) {
         if (system.constructor.name === target_name) {
            return true;
         }
      }

      logger.trace(`system type ${target_name} not found`);

      return false;
   }

   validate_dependencies(
      caller_name: string,
      dependencies?: SystemDependencies
   ): void {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      logger.trace(`validating dependencies for system: ${caller_name}`);

      if (dependencies?.components) {
         logger.trace(`checking component dependencies for ${caller_name}...`);

         if (!this.z$_resource_check_dependencies_component.data.has(caller_name)) {
            this.z$_resource_check_dependencies_component.data.set(caller_name, new Set());
         }

         const cache = this.z$_resource_check_dependencies_component.data.get(caller_name)!;

         for (const name of dependencies.components) {
            if (!cache.has(name)) {
               /// #if SAFETY
               if (!this.#world.component_is_registered(name)) {
                  {
                     const message = `system dependency error for '${caller_name}': required component '${name}' is not registered in the world (no entity currently has this component)`;

                     logger.critical(message);
                     throw new Error(message);
                  }
               }
               /// #endif

               cache.add(name);
            }
         }
      }
   }
}
