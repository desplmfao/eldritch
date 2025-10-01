/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/types/system.ts
 */

import type { MaybePromise } from '@eldritch-engine/type-utils';

export type SystemConstructorParameters<S> =
   (S extends new (
      ...args: infer P
   ) => unknown
      ? P
      : never);

export type SystemConstructor<S extends System = System> =
   new (
      ...args: SystemConstructorParameters<S>
   ) => S;

/** defines dependencies for systems */
export interface SystemDependencies {
   /**
    * globally unique system names (plugin_name::system_name) that must run before this one within the same schedule phase
    * 
    * used by the MasterScheduler to build the execution dag
    */
   readonly systems?: string[];

   /** 
    * component names this system reads from or writes to
    * 
    * used for change detection and can be used for intra-plugin validation
    */
   readonly components?: string[];
}

export abstract class System {
   /** execution order hint (for sequential runs and  inter-schedule ordering) */
   readonly order: number = 0;

   /** explicit dependencies and access patterns */
   readonly dependencies: SystemDependencies = {};

   /** */
   run_criteria?(...injections: unknown[]): MaybePromise<boolean>;
   /** */
   initialize?(...injections: unknown[]): MaybePromise<boolean>;
   /** */
   cleanup?(...injections: unknown[]): MaybePromise<boolean>;

   /** */
   abstract update(...injections: unknown[]): MaybePromise<unknown>;
}

export type SystemEntry = {
   /** */
   system: System;
   /** */
   order: number;
};
