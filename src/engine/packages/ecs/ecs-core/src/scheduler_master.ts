/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/scheduler_master.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@self/types/world';
import type { System } from '@self/types/system';
import type { Plugin } from '@self/types/plugin';
import { Schedule } from '@self/types/schedule';

export interface SystemRegistrationInfo {
   system: System;
   owner_plugin: Plugin;
   schedules: Set<Schedule>;
}

export class MasterScheduler {
   #world: IWorld;

   system_registry: Map<string, SystemRegistrationInfo> = new Map();

   execution_plans: Map<
      Schedule,
      {
         system: System;
         owner_plugin: Plugin
      }[]
   > = new Map();

   plans_are_dirty: boolean = true;

   constructor(world: IWorld) {
      this.#world = world;
   }

   register_system(
      plugin: Plugin,
      system: System,
      schedules: Schedule | Schedule[]
   ): void {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      const plugin_name = plugin.constructor.name;
      const system_name = system.constructor.name;

      const global_id = `${plugin_name}::${system_name}`;

      const new_schedules_set = new Set(Array.isArray(schedules) ? schedules : [schedules]);

      if (this.system_registry.has(global_id)) {
         const existing_reg = this.system_registry.get(global_id)!;

         for (const schedule of new_schedules_set) {
            existing_reg.schedules.add(schedule);
         }

         logger.trace(`system '${global_id}' re-registered/schedules updated. now targets: [${[...existing_reg.schedules].map(s => Schedule[s]).join(', ')}]`);
      } else {
         this.system_registry.set(
            global_id,
            {
               system: system,
               owner_plugin: plugin,
               schedules: new_schedules_set,
            }
         );

         logger.trace(`system '${global_id}' registered from plugin '${plugin_name}'. targets: [${[...new_schedules_set].map(s => Schedule[s]).join(', ')}]`);
      }

      this.plans_are_dirty = true;
   }

   unregister_system(
      plugin: Plugin,
      system: System
   ): void {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      const plugin_name = plugin.constructor.name;
      const system_name = system.constructor.name;

      const global_id = `${plugin_name}::${system_name}`;

      if (this.system_registry.has(global_id)) {
         this.system_registry.delete(global_id);
         this.plans_are_dirty = true;

         logger.trace(`system '${global_id}' unregistered`);
      }
   }

   rebuild_all_execution_plans_if_dirty(): void {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      if (!this.plans_are_dirty) {
         logger.trace('execution plans are not dirty, skipping rebuild');

         return;
      }

      logger.trace('execution plans are dirty, rebuilding all...');

      this.execution_plans.clear();

      for (const schedule_value in Schedule) {
         const schedule = Number(schedule_value) as Schedule;

         if (Number.isNaN(schedule)) {
            continue;
         }

         this.build_execution_plan_for_schedule(schedule);
      }

      this.plans_are_dirty = false;
   }

   build_execution_plan_for_schedule(
      schedule: Schedule
   ): void {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      logger.trace(`building execution plan for schedule: '${Schedule[schedule]}'`);

      const systems_for_this_schedule: {
         system: System;
         owner_plugin: Plugin;
         global_id: string
      }[] = [];

      for (const [global_id, reg_info] of this.system_registry) {
         if (reg_info.schedules.has(schedule)) {
            systems_for_this_schedule.push({
               system: reg_info.system,
               owner_plugin: reg_info.owner_plugin,
               global_id: global_id
            });
         }
      }

      if (systems_for_this_schedule.length === 0) {
         this.execution_plans.set(schedule, []);

         logger.trace(`no systems for schedule '${Schedule[schedule]}', plan is empty`);

         return;
      }

      const adj: Map<string, string[]> = new Map();
      const in_degree: Map<string, number> = new Map();

      for (const item of systems_for_this_schedule) {
         adj.set(item.global_id, []);
         in_degree.set(item.global_id, 0);
      }

      for (const item of systems_for_this_schedule) {
         const depender_global_id = item.global_id;
         const dependencies = item.system.dependencies?.systems ?? [];

         for (const dependency_global_id of dependencies) {
            /// #if SAFETY
            if (!adj.has(dependency_global_id)) {
               logger.warn(`system '${depender_global_id}' has dependency '${dependency_global_id}' which is not found among systems for schedule '${Schedule[schedule]}'. this dependency will be ignored for ordering within this schedule`);

               continue;
            }
            /// #endif

            adj.get(dependency_global_id)!.push(depender_global_id);
            in_degree.set(depender_global_id, (in_degree.get(depender_global_id) ?? 0) + 1);
         }
      }

      const queue: {
         system: System;
         owner_plugin: Plugin;
         global_id: string;
         order: number
      }[] = [];

      for (const item of systems_for_this_schedule) {
         if (in_degree.get(item.global_id) === 0) {
            queue.push({
               ...item,
               order: item.system.order
            });
         }
      }

      queue.sort((a, b) => a.order - b.order);

      const sorted_plan_intermediate: {
         system: System;
         owner_plugin: Plugin
      }[] = [];

      let visited_count = 0;

      while (queue.length > 0) {
         const current_item_wrapper = queue.shift()!;

         sorted_plan_intermediate.push({
            system: current_item_wrapper.system,
            owner_plugin: current_item_wrapper.owner_plugin
         });

         visited_count++;

         for (const neighbor_global_id of adj.get(current_item_wrapper.global_id)!) {
            in_degree.set(neighbor_global_id, in_degree.get(neighbor_global_id)! - 1);

            if (in_degree.get(neighbor_global_id) === 0) {
               const neighbor_system_info = systems_for_this_schedule.find(s => s.global_id === neighbor_global_id)!;

               queue.push({
                  ...neighbor_system_info,
                  order: neighbor_system_info.system.order
               });

               queue.sort((a, b) => a.order - b.order);
            }
         }
      }

      /// #if SAFETY
      if (visited_count !== systems_for_this_schedule.length) {
         const unvisited = systems_for_this_schedule.filter(s => !sorted_plan_intermediate.some(sp => sp.system === s.system));
         const cycle_details = unvisited.map(s => `${s.global_id} (in_degree: ${in_degree.get(s.global_id)}, deps: [${s.system.dependencies.systems?.join(', ') || ''}])`).join('; ');

         {
            const message = `cycle detected in system dependencies for schedule '${Schedule[schedule]}'. cannot build execution plan. involved systems (approx): ${cycle_details}`;

            logger.critical(message);
            throw new Error(message);
         }
      }
      /// #endif

      this.execution_plans.set(schedule, sorted_plan_intermediate);

      logger.trace(`built plan for ${Schedule[schedule]}: ${sorted_plan_intermediate.map(e => `${e.owner_plugin.constructor.name}::${e.system.constructor.name} (order ${e.system.order})`).join(' -> ')}`);
   }

   get_execution_plan(
      schedule: Schedule
   ): {
      system: System;
      owner_plugin: Plugin
   }[] {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      /// #if SAFETY
      if (!this.execution_plans.has(schedule)) {
         logger.critical(`attempted to get execution plan for schedule '${Schedule[schedule]}' but it has not been built. plans may be dirty`);

         return [];
      }
      /// #endif

      return this.execution_plans.get(schedule) ?? [];
   }

   async initialize_all_systems(): Promise<void> {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      logger.trace(`initializing all registered systems...`);

      const unique_systems_to_init = new Map<System, Plugin>();

      for (const reg_info of this.system_registry.values()) {
         if (!unique_systems_to_init.has(reg_info.system)) {
            unique_systems_to_init.set(reg_info.system, reg_info.owner_plugin);
         }
      }

      for (const [system, owner_plugin] of unique_systems_to_init) {
         await owner_plugin.scheduler.initialize_system_internal(this.#world, system);
      }
   }

   async cleanup_all_systems(): Promise<void> {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      logger.trace(`cleaning up all registered systems...`);

      const unique_systems_to_cleanup = new Map<System, Plugin>();

      for (const reg_info of this.system_registry.values()) {
         if (!unique_systems_to_cleanup.has(reg_info.system)) {
            unique_systems_to_cleanup.set(reg_info.system, reg_info.owner_plugin);
         }
      }

      for (const [system, owner_plugin] of unique_systems_to_cleanup) {
         await owner_plugin.scheduler.cleanup_system_internal(this.#world, system);
      }

      this.system_registry.clear();
      this.execution_plans.clear();

      this.plans_are_dirty = true;
   }
}