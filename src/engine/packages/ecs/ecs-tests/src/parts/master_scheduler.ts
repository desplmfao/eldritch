/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-tests/src/parts/master_scheduler.ts
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';

import type { IWorldStorageBackend } from '@eldritch-engine/ecs-core/types/world_storage_backend';
import { Plugin } from '@eldritch-engine/ecs-core/types/plugin';
import { System } from '@eldritch-engine/ecs-core/types/system';
import { Schedule } from '@eldritch-engine/ecs-core/types/schedule';

class SysA extends System {
   update = mock(() => { });
}

class SysB extends System {
   override dependencies = {
      systems: [`${PluginA.name}::${SysA.name}`]
   };

   update = mock(() => { });
}

class SysC extends System {
   override dependencies = {
      systems: [`${PluginB.name}::${SysB.name}`]
   };

   update = mock(() => { });
}

class SysD extends System {
   override order = 1;

   update = mock(() => { });
}

class SysE extends System {
   override order = 0;

   update = mock(() => { });
}

class CycleA extends System {
   override dependencies = {
      systems: [`${PluginCycle.name}::${CycleC.name}`]
   };

   update = mock(() => { });
}

class CycleB extends System {
   override dependencies = {
      systems: [`${PluginCycle.name}::${CycleA.name}`]
   };

   update = mock(() => { });
}

class CycleC extends System {
   override dependencies = {
      systems: [`${PluginCycle.name}::${CycleB.name}`]
   };

   update = mock(() => { });
}

class PluginA extends Plugin {
   build = async () => true;
}

class PluginB extends Plugin {
   override dependencies = [PluginA.name];

   build = async () => true;
}

class PluginC extends Plugin {
   override dependencies = [PluginB.name];

   build = async () => true;
}

class PluginCycle extends Plugin {
   build = async () => true;
}

export async function make_test(
   storage_backend: IWorldStorageBackend
) {
   describe('master scheduler', () => {
      let world: World;

      let plugin_a: PluginA;
      let plugin_b: PluginB;
      let plugin_c: PluginC;

      beforeEach(async () => {
         world = new World({
            storage_backend,
            logger_options: {
               log_level: 2
            }
         });

         plugin_a = new PluginA();
         plugin_b = new PluginB();
         plugin_c = new PluginC();
      });

      it('should correctly build an execution plan based on system dependencies', async () => {
         const sys_a = new SysA();
         const sys_b = new SysB();
         const sys_c = new SysC();

         await world.add_plugins([plugin_a, plugin_b, plugin_c]);

         await plugin_a.scheduler.system_add(Schedule.Update, sys_a);
         await plugin_b.scheduler.system_add(Schedule.Update, sys_b);
         await plugin_c.scheduler.system_add(Schedule.Update, sys_c);

         world.master_scheduler.rebuild_all_execution_plans_if_dirty();

         const plan = world.master_scheduler.get_execution_plan(Schedule.Update);

         const system_names = plan.map(p => p.system.constructor.name);
         expect(system_names).toEqual(['SysA', 'SysB', 'SysC']);
      });

      it('should respect the `order` property for systems at the same dependency level', async () => {
         const sys_d = new SysD();
         const sys_e = new SysE();

         await world.add_plugin(plugin_a);

         await plugin_a.scheduler.system_add(Schedule.Update, sys_d);
         await plugin_a.scheduler.system_add(Schedule.Update, sys_e);

         world.master_scheduler.rebuild_all_execution_plans_if_dirty();

         const plan = world.master_scheduler.get_execution_plan(Schedule.Update);

         const system_names = plan.map(p => p.system.constructor.name);
         expect(system_names).toEqual(['SysE', 'SysD']);
      });

      it('should throw an error when a dependency cycle is detected', async () => {
         const cycle_plugin = new PluginCycle();
         await world.add_plugin(cycle_plugin);

         await cycle_plugin.scheduler.system_add(Schedule.Update, new CycleA());
         await cycle_plugin.scheduler.system_add(Schedule.Update, new CycleB());
         await cycle_plugin.scheduler.system_add(Schedule.Update, new CycleC());

         const build_plan = () => world.master_scheduler.rebuild_all_execution_plans_if_dirty();

         expect(build_plan).toThrow(/cycle detected in system dependencies/);
      });

      it('should ignore dependencies on systems not in the same schedule', async () => {
         const sys_a = new SysA();
         const sys_b_dep_a = new SysB();

         await world.add_plugins([plugin_a, plugin_b]);

         await plugin_a.scheduler.system_add(Schedule.Update, sys_a);
         await plugin_b.scheduler.system_add(Schedule.FixedUpdate, sys_b_dep_a);

         world.master_scheduler.rebuild_all_execution_plans_if_dirty();

         const update_plan = world.master_scheduler.get_execution_plan(Schedule.Update);
         expect(update_plan.length).toBe(1);
         expect(update_plan[0]?.system).toBe(sys_a);

         const fixed_update_plan = world.master_scheduler.get_execution_plan(Schedule.FixedUpdate);
         expect(fixed_update_plan.length).toBe(1);
         expect(fixed_update_plan[0]?.system).toBe(sys_b_dep_a);
      });
   });
}