/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/types/plugin.ts
 */

import type { MaybePromise } from '@eldritch-engine/type-utils';

import type { IWorld } from '@self/types/world';
import { Scheduler } from '@self/scheduler';

export abstract class Plugin {
   /** an array of plugin names that this plugin depends on. the World will ensure these plugins are added and built *before* this plugin */
   readonly dependencies: string[] = [];

   /** the scheduler instance specific to this plugin, managing its systems */
   scheduler!: Scheduler;

   /**
    * initializes the plugin's internal scheduler
    *
    * this is typically called by the World when the plugin is added, or can be called within the build method
    */
   async $initialize_scheduler(
      world: IWorld
   ): Promise<void> {
      if (!this.scheduler) {
         this.scheduler = new Scheduler(world, this);
      }
   }

   /** builds the plugin, adding resources, systems, etc., to the world. called when the plugin is added to the world */
   abstract build(...injections: unknown[]): MaybePromise<boolean>;

   /** called after the world's FirstStartup schedule runs */
   first_startup?(...injections: unknown[]): MaybePromise<unknown>;
   /** called after the world's PreStartup schedule runs */
   pre_startup?(...injections: unknown[]): MaybePromise<unknown>;
   /** called after the world's Startup schedule runs */
   post_startup?(...injections: unknown[]): MaybePromise<unknown>;
   /** called after the world's PostStartup schedule runs AND the deferred command flushing */
   last_startup?(...injections: unknown[]): MaybePromise<unknown>;

   /** cleans up resources created by the plugin. called when the world is shutting down or the plugin is removed */
   remove?(...injections: unknown[]): MaybePromise<unknown>;
}

export type PluginConstructor<P extends Plugin = Plugin> = new (...args: any[]) => P;