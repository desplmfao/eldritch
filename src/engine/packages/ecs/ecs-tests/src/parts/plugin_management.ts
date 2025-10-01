/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-tests/src/parts/plugin_management.ts
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

import { World } from '@eldritch-engine/ecs-core/world';

import type { IWorldStorageBackend } from '@eldritch-engine/ecs-core/types/world_storage_backend';
import { Plugin } from '@eldritch-engine/ecs-core/types/plugin';

let hook_execution_order: string[] = [];

class PluginA extends Plugin {
   build = async () => true;

   override pre_startup = mock(async () => {
      hook_execution_order.push(`${PluginA.name}::pre_startup`)
   });
}

class PluginB extends Plugin {
   build = async () => true;

   override post_startup = mock(async () => {
      hook_execution_order.push(`${PluginB.name}::post_startup`)
   });
}

class PluginC extends Plugin {
   build = async () => true;

   override remove = mock(async () => {
      hook_execution_order.push(`${PluginC.name}::remove`)
   });
}

export async function make_test(
   storage_backend: IWorldStorageBackend
) {
   describe('plugin management', () => {
      let world: World;

      beforeEach(() => {
         world = new World({
            storage_backend,
            logger_options: {
               log_level: 2
            }
         });

         hook_execution_order = [];
      });

      it('should successfully add plugins in the correct dependency order', async () => {
         const plugin_a = new PluginA();
         const plugin_b = new PluginB();
         const plugin_c = new PluginC();

         await world.add_plugin(plugin_a);
         await world.add_plugin(plugin_b);
         await world.add_plugin(plugin_c);

         expect(world.plugins.has(PluginA)).toBe(true);
         expect(world.plugins.has(PluginB)).toBe(true);
         expect(world.plugins.has(PluginC)).toBe(true);
      });

      it('should throw an error if a plugin dependency is not met', async () => {
         const plugin_b = new PluginB();

         const add_plugin_b = () => world.add_plugin(plugin_b);

         expect(add_plugin_b).toThrow(new Error(`failed to add plugin 'PluginB': dependency 'PluginA' is not registered. add the dependency plugin first`));
         expect(world.plugins.has(PluginB)).toBe(false);
      });

      it('should call plugin lifecycle hooks during world initialization', async () => {
         const plugin_a = new PluginA();
         const plugin_b = new PluginB();

         await world.add_plugins([plugin_a, plugin_b]);
         await world.initialize();

         expect(plugin_a.pre_startup).toHaveBeenCalledTimes(1);
         expect(plugin_b.post_startup).toHaveBeenCalledTimes(1);

         expect(hook_execution_order).toEqual(['PluginA::pre_startup', 'PluginB::post_startup']);
      });

      it('should call the remove hook on all plugins during world cleanup', async () => {
         const plugin_a = new PluginA();
         const plugin_b = new PluginB();
         const plugin_c = new PluginC();

         await world.add_plugins([plugin_a, plugin_b, plugin_c]);
         await world.cleanup();

         expect(plugin_c.remove).toHaveBeenCalledTimes(1);
      });
   });
}