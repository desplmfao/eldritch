/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/operations/scheduler.ts
 */

import { get_metadata } from '@eldritch-engine/reflect/index';
import { default_logger } from '@eldritch-engine/logger/logger';

import { resolve_and_execute, METHOD_METADATA_KEY } from '@self/reflect/index';

import type { IWorld } from '@self/types/world';
import { is_fixed_schedule, is_render_schedule, Schedule } from '@self/types/schedule';

import type { ResourceReflectionMap } from '@self/ecs/resources/reflection';
import type { ResourceLoopControl } from '@self/ecs/resources/loop_control';

import type {
   ResourceComponentLastWriteTick,
   ResourceDeltaTimeLogical,
   ResourceDeltaTimeRender,
   ResourceSystemLastWriteTick,
   ResourceWorldTick
} from '@self/ecs/resources/core';

export async function scheduler_run(
   world: IWorld,
   //
   r_loop_control: ResourceLoopControl
): Promise<void> {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   if (r_loop_control.is_running) {
      logger.warn('called while loop is already running');

      return;
   }

   if (!world.initialized) {
      logger.warn('called before initialize. please initialize the world first');
   }

   r_loop_control.is_running = true;
   r_loop_control.last_render_time_ms = performance.now();

   // TODO: run shit here
}

export async function scheduler_stop(
   r_loop_control: ResourceLoopControl
): Promise<void> {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   if (!r_loop_control.is_running) {
      logger.warn('called while not running');

      return;
   }

   logger.trace('requesting main world loop stop...');

   r_loop_control.is_running = false;
}

/**
 * helper function for executing plugin startup lifecycle hooks 
 *
 * @internal
 */
export async function execute_plugin_startup_hook(
   world: IWorld,
   //
   r_reflection_map: ResourceReflectionMap,
   //
   schedule: Schedule,
   hook_name: 'first_startup' | 'pre_startup' | 'post_startup' | 'last_startup'
): Promise<void> {
   const logger = default_logger.get_namespaced_logger(`<namespace>::${Schedule[schedule]}`);

   logger.trace(`calling ${hook_name} hooks for ${world.plugins.size} plugins...`);

   for (const plugin of world.plugins.values()) {
      if (plugin[hook_name]) {
         if (get_metadata(METHOD_METADATA_KEY, plugin, hook_name)) {
            await resolve_and_execute(world, r_reflection_map, plugin, hook_name, [world]);
         } else {
            await plugin[hook_name]!(world);
         }
      }
   }
}

export async function scheduler_update(
   world: IWorld,
   //
   r_reflection_map: ResourceReflectionMap,
   r_system_last_write_tick: ResourceSystemLastWriteTick,
   r_component_last_write_tick: ResourceComponentLastWriteTick,
   r_world_tick: ResourceWorldTick,
   r_delta_time_logical: ResourceDeltaTimeLogical,
   r_delta_time_render: ResourceDeltaTimeRender,
   //
   schedule: Schedule,
   delta_time?: number
): Promise<void> {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   if (schedule === Schedule.FixedUpdate) {
      r_world_tick.data++;
   }

   await world.notify('schedule_started', schedule);

   world.master_scheduler.rebuild_all_execution_plans_if_dirty();

   const execution_plan = world.master_scheduler.get_execution_plan(schedule);

   if (is_fixed_schedule(schedule)) {
      r_delta_time_logical.data = delta_time ?? -1;
   } else if (is_render_schedule(schedule)) {
      r_delta_time_render.data = delta_time ?? -1;
   }

   /// #if LOGGER_HAS_TRACE
   if (execution_plan.length > 0) {
      logger.trace(`executing ${execution_plan.length} systems for schedule ${Schedule[schedule]}`);
   }
   /// #endif

   for (const { system, owner_plugin } of execution_plan) {
      const system_name = system.constructor.name;
      const plugin_name = owner_plugin.constructor.name;

      if (system.run_criteria) {
         const should_run = get_metadata(METHOD_METADATA_KEY, system, 'run_criteria')
            ? await resolve_and_execute(world, r_reflection_map, system, 'run_criteria', [world])
            : await system.run_criteria(world);

         if (!should_run) {
            continue;
         }
      }

      const system_dependencies_components = system.dependencies.components;
      const last_run_tick = r_system_last_write_tick.data.get(system) ?? -1;
      let should_run_due_to_change = true;

      if (
         system_dependencies_components
         && system_dependencies_components.length > 0
         && last_run_tick !== -1
      ) {
         should_run_due_to_change = false;

         for (const comp_name of system_dependencies_components) {
            const last_write = r_component_last_write_tick.data.get(comp_name) ?? -1;

            if (last_write > last_run_tick) {
               should_run_due_to_change = true;

               break;
            }
         }
      }

      if (!should_run_due_to_change) {
         logger.trace(`skipping system ${plugin_name}::${system_name}: no relevant component changes`);

         continue;
      }

      logger.trace(`running system: ${plugin_name}::${system_name}`);

      if (get_metadata(METHOD_METADATA_KEY, system, 'update')) {
         await resolve_and_execute(world, r_reflection_map, system, 'update', [world]);
      } else {
         await system.update(world);
      }

      r_system_last_write_tick.data.set(system, r_world_tick.data);
   }

   switch (schedule) {
      case Schedule.FirstStartup: {
         await execute_plugin_startup_hook(world, r_reflection_map, schedule, 'first_startup');

         break;
      }

      case Schedule.PreStartup: {
         await execute_plugin_startup_hook(world, r_reflection_map, schedule, 'pre_startup');

         break;
      }

      case Schedule.PostStartup: {
         await execute_plugin_startup_hook(world, r_reflection_map, schedule, 'post_startup');

         break;
      }

      case Schedule.LastStartup: {
         await execute_plugin_startup_hook(world, r_reflection_map, schedule, 'last_startup');

         break;
      }

      default: {
         break;
      }
   }

   await world.notify('schedule_ended', schedule);
}

export async function scheduler_initialize(
   world: IWorld,
): Promise<boolean> {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   if (world.initialized) {
      logger.warn('initialize called more than once');
   }

   await world.update(Schedule.FirstStartup);
   await world.update(Schedule.PreStartup);
   await world.update(Schedule.Startup);

   await world.master_scheduler.initialize_all_systems();

   await world.update(Schedule.PostStartup);
   await world.update(Schedule.FixedFlush);
   await world.update(Schedule.LastStartup);

   world.initialized = true;

   return world.initialized;
}

export async function scheduler_cleanup(
   world: IWorld
): Promise<boolean> {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   world.storage_backend.cleanup?.();

   await world.master_scheduler.cleanup_all_systems();

   logger.trace(`calling cleanup hooks for ${world.plugins.size} plugins...`);

   for (const plugin of world.plugins.values()) {
      await plugin.remove?.(world);
   }

   world.storage.clear();
   world.plugins.clear();
   await world.observer.clear();

   world.initialized = false;

   logger.trace('world cleanup complete');

   return !world.initialized;
}