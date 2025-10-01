/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-tests/src/parts/scheduler.ts
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';

import type { IWorldStorageBackend } from '@eldritch-engine/ecs-core/types/world_storage_backend';
import { Scheduler } from '@eldritch-engine/ecs-core/scheduler';
import { Plugin } from '@eldritch-engine/ecs-core/types/plugin';
import { Component } from '@eldritch-engine/ecs-core/types/component';
import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';
import { System } from '@eldritch-engine/ecs-core/types/system';

import {
   ResourceDeltaTimeLogical,
   ResourceDeltaTimeRender
} from '@eldritch-engine/ecs-core/ecs/resources/core';

let execution_order: string[] = [];

class CompX extends Component { }

class SysA extends System {
   override order = 1;

   override initialize = mock(async () => {
      execution_order.push('InitA');

      return true;
   });

   override cleanup = mock(async () => {
      execution_order.push('CleanupA');

      return true;
   });

   update = mock(async () => {
      execution_order.push('UpdateA');
   });
}

class SysB extends System {
   override order = 0;

   override initialize = mock(async () => {

      execution_order.push('InitB');

      return true;
   });

   override cleanup = mock(async () => {
      execution_order.push('CleanupB');

      return true;
   });

   update = mock(async () => {
      execution_order.push('UpdateB');
   });
}

class SysC extends System {
   override dependencies = {
      systems: [
         `${TestPlugin.name}::${SysA.name}`
      ]
   };

   override initialize = mock(async () => {
      execution_order.push('InitC');

      return true;
   });

   override cleanup = mock(async () => {
      execution_order.push('CleanupC');

      return true;
   });

   update = mock(async () => {
      execution_order.push('UpdateC');
   });
}

class SysWithCompDep extends System {
   override dependencies = {
      components: [CompX.name]
   };

   override initialize = mock(async () => true);
   override cleanup = mock(async () => true);

   update = mock(async () => {
      execution_order.push('UpdateCompDep');
   });
}

class SysDoesNotExist extends System {
   update() { }
}

class TestPlugin extends Plugin {
   build = async () => true;
}

export async function make_test(
   storage_backend: IWorldStorageBackend
) {
   describe('scheduler', () => {
      let scheduler: Scheduler;
      let world: World;
      let plugin: TestPlugin;

      beforeEach(async () => {
         world = new World({
            storage_backend
         });

         plugin = new TestPlugin();
         await world.add_plugin(plugin);
         scheduler = plugin.scheduler;

         world.notify = mock(world.notify);
         world.component_is_registered = mock(world.component_is_registered);
         execution_order = [];
      });

      it('should add a system to pending additions', async () => {
         const sys_a = new SysA();

         await scheduler.system_add(Schedule.Update, sys_a);

         expect(scheduler.pending_additions.has(sys_a)).toBe(true);
         expect(scheduler.pending_additions.get(sys_a)?.schedules).toEqual([Schedule.Update]);
         expect(world.notify).toHaveBeenCalledWith('system_created', sys_a);
      });

      it('should process pending additions when a schedule runs', async () => {
         const sys_a = new SysA();

         await scheduler.system_add(Schedule.Update, sys_a);
         await scheduler.process_pending_systems_internal();

         expect(scheduler.pending_additions.size).toBe(0);
         const active_systems = scheduler.systems_by_schedule.get(Schedule.Update);
         expect(active_systems).toBeDefined();
         expect([...active_systems!].some(e => e.system === sys_a)).toBe(true);
      });

      it('should add a system for removal', async () => {
         const sys_a = new SysA();

         await scheduler.system_add(Schedule.Update, sys_a);
         await scheduler.process_pending_systems_internal()
         await scheduler.system_remove(sys_a);

         expect(scheduler.pending_removals.has(sys_a)).toBe(true);
         expect(world.notify).toHaveBeenCalledWith('system_stopped', sys_a);
      });

      it('should remove system from pending addition if remove called before processing', async () => {
         const sys_a = new SysA();

         await scheduler.system_add(Schedule.Update, sys_a);
         expect(world.notify).toHaveBeenCalledWith('system_created', sys_a);

         await scheduler.system_remove(sys_a);
         expect(world.notify).toHaveBeenCalledWith('system_stopped', sys_a);

         expect(scheduler.pending_additions.has(sys_a)).toBe(false);
         expect(scheduler.pending_removals.has(sys_a)).toBe(false);

         await world.update(Schedule.Update, 0.1);
         expect(sys_a.update).not.toHaveBeenCalled();
      });

      it('should process pending removals when a schedule runs', async () => {
         const sys_a = new SysA();

         await scheduler.system_add(Schedule.Update, sys_a);
         await scheduler.process_pending_systems_internal();
         await scheduler.system_remove(sys_a);

         expect(scheduler.pending_removals.size).toBe(1);

         sys_a.update.mockClear();
         await scheduler.process_pending_systems_internal();

         expect(scheduler.pending_removals.size).toBe(0);
         const active_systems = scheduler.systems_by_schedule.get(Schedule.Update);

         expect([...(active_systems || [])].some(e => e.system === sys_a)).toBe(false);
      });


      it('should run systems in correct order', async () => {
         const sys_a = new SysA();
         const sys_b = new SysB();

         await scheduler.system_add(Schedule.FixedUpdate, sys_a);
         await scheduler.system_add(Schedule.FixedUpdate, sys_b);
         await world.update(Schedule.FixedUpdate, 0.1);

         expect(execution_order).toEqual(['UpdateB', 'UpdateA']);
      });

      it('should call initialize on world.initialize()', async () => {
         const sys_a = new SysA();
         const sys_b = new SysB();

         await scheduler.system_add(Schedule.Update, sys_a);
         await scheduler.system_add(Schedule.FixedUpdate, sys_b);

         await world.initialize();

         expect(sys_a.initialize).toHaveBeenCalledTimes(1);
         expect(sys_b.initialize).toHaveBeenCalledTimes(1);
         expect(world.notify).toHaveBeenCalledWith('system_initialized', sys_a);
         expect(world.notify).toHaveBeenCalledWith('system_initialized', sys_b);

         expect(execution_order).toContain('InitA');
         expect(execution_order).toContain('InitB');
         expect(execution_order).toHaveLength(2);

         execution_order = [];
         sys_a.initialize.mockClear();
         sys_b.initialize.mockClear();

         await world.initialize();

         expect(sys_a.initialize).not.toHaveBeenCalled();
         expect(sys_b.initialize).not.toHaveBeenCalled();
         expect(execution_order).toEqual([]);
      });

      it('should call cleanup on world.cleanup()', async () => {
         const sys_a = new SysA();

         await scheduler.system_add(Schedule.Update, sys_a);
         await world.initialize();
         await world.cleanup();

         expect(sys_a.cleanup).toHaveBeenCalledTimes(1);
         expect(world.notify).toHaveBeenCalledWith('system_cleaned', sys_a);
         expect(execution_order).toEqual(['InitA', 'CleanupA']);
         expect(scheduler.systems_by_schedule.size).toBe(0);
      });

      it('should validate and pass with existing system dependency', async () => {
         await scheduler.system_add(Schedule.Update, new SysA());
         expect(await scheduler.system_add(Schedule.Update, new SysC())).toBe(true);
      });

      it('should validate and throw on missing component dependency', async () => {
         expect(scheduler.system_add(Schedule.Update, new SysWithCompDep())).rejects.toThrow(
            `system dependency error for '${SysWithCompDep.name}': required component '${CompX.name}' is not registered in the world (no entity currently has this component)`
         );

         expect(world.component_is_registered).toHaveBeenCalledWith(CompX.name);
      });

      it('should validate and pass with existing component dependency', async () => {
         (world.component_is_registered as any).mockImplementation((ctor_name: any) => {
            return ctor_name === CompX.name;
         });

         expect(await scheduler.system_add(Schedule.Update, new SysWithCompDep())).toBe(true);
         expect(world.component_is_registered).toHaveBeenCalledWith(CompX.name);
      });

      it('should get an active system instance', async () => {
         const sys_a = new SysA();

         await scheduler.system_add(Schedule.Update, sys_a);
         await scheduler.process_pending_systems_internal();

         expect(scheduler.system_get(SysA)).toBe(sys_a);
      });

      it('should get a pending system instance', async () => {
         const sys_a = new SysA();

         await scheduler.system_add(Schedule.Update, sys_a);

         expect(scheduler.system_get(SysA)).toBe(sys_a);
      });

      it('should throw when getting non-existent system', () => {
         expect(() => scheduler.system_get(SysDoesNotExist)).toThrow(`system of type '${SysDoesNotExist.name}' not found in scheduler`);
      });

      it('should set DELTA_TIME_LOGICAL for fixed schedules', async () => {
         await scheduler.system_add(Schedule.FixedUpdate, new SysA());
         await world.update(Schedule.FixedUpdate, 0.016);

         expect(world.storage.get(ResourceDeltaTimeLogical)?.data.valueOf()).toBe(0.016);
         expect(world.storage.get(ResourceDeltaTimeRender)?.data.valueOf()).toBe(-1);
      });

      it('should set DELTA_TIME_RENDER for render schedules', async () => {
         await scheduler.system_add(Schedule.Update, new SysA());
         await world.update(Schedule.Update, 0.033);

         expect(world.storage.get(ResourceDeltaTimeRender)?.data.valueOf()).toBe(0.033);
         expect(world.storage.get(ResourceDeltaTimeLogical)?.data.valueOf()).toBe(-1);
      });
   });
}