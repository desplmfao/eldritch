/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/operations/plugin.ts
 */

import { get_metadata } from '@eldritch-engine/reflect/index';
import { default_logger } from '@eldritch-engine/logger/logger';

import type { IWorld } from '@self/types/world';
import type { Plugin, PluginConstructor } from '@self/types/plugin';

import type { ResourceReflectionMap } from '@self/ecs/resources/reflection';

import { METHOD_METADATA_KEY, resolve_and_execute } from '@self/reflect/index';

export function is_single_plugin(
   plugins: Plugin | Plugin[]
): plugins is Plugin {
   return !Array.isArray(plugins);
}

export async function add_plugin(
   world: IWorld,
   //
   r_reflection_map: ResourceReflectionMap,
   //
   plugin: Plugin
): Promise<boolean> {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const plugin_constructor = plugin.constructor as PluginConstructor;
   const plugin_name = plugin_constructor.name || 'AnonymousPlugin';

   logger.trace(`attempting to add plugin: '${plugin_name}'`);

   if (world.plugins.has(plugin_constructor)) {
      logger.warn(`plugin '${plugin_name}' is already added. skipping`);

      return false;
   }

   logger.trace(`checking dependencies for '${plugin_name}': [${plugin.dependencies.join(', ')}]`);

   const registered_plugin_names = new Set([...world.plugins.keys()].map(p_ctor => p_ctor.name));

   for (const dependency_name of plugin.dependencies) {
      /// #if SAFETY
      if (!registered_plugin_names.has(dependency_name)) {
         {
            const message = `failed to add plugin '${plugin_name}': dependency '${dependency_name}' is not registered. add the dependency plugin first`;

            logger.critical(message);
            throw new Error(message);
         }
      }
      /// #endif

      logger.trace(`   -> dependency '${dependency_name}' met`);
   }

   logger.trace(`all dependencies met for '${plugin_name}'`);

   try {
      logger.trace(`initializing scheduler for plugin '${plugin_name}'...`);

      await plugin.$initialize_scheduler(world);

      logger.trace(`building plugin '${plugin_name}'...`);

      const is_di_target = get_metadata(METHOD_METADATA_KEY, plugin, 'build');
      let build_success;

      if (is_di_target) {
         build_success = await resolve_and_execute(world, r_reflection_map, plugin, 'build', [world]);
      } else {
         build_success = await plugin.build(world);
      }

      if (!build_success) {
         {
            const message = `plugin '${plugin_name}' build method returned false. plugin will not be added`

            logger.critical(message);
            throw new Error(message);
         }
      }

      logger.trace(`plugin '${plugin_name}' built successfully`);
   } catch (e) {
      {
         const message = `error building plugin '${plugin_name}'\n${e.message}`;

         logger.critical(message);
         throw new Error(message, { cause: e });
      }
   }

   world.plugins.set(plugin_constructor, plugin);

   await world.notify('plugin_added', plugin);

   logger.trace(`plugin '${plugin_name}' added successfully`);

   return true;
}

export async function add_plugins(
   world: IWorld,
   //
   plugins_tuple: (Plugin | Plugin[])[]
): Promise<void> {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   for (const plugins of plugins_tuple) {
      if (is_single_plugin(plugins)) {
         logger.trace(`adding single plugin:`, plugins.constructor.name);

         await world.add_plugin(plugins);
      } else {
         logger.trace(`adding plugin tuple:`, plugins.map((p) => p.constructor.name));

         for (const plugin of plugins) {
            await world.add_plugin(plugin);
         }
      }
   }
}