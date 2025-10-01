/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/types/schedule.ts
 */

export enum Schedule {
   FirstStartup,
   PreStartup,
   Startup,
   PostStartup,
   LastStartup,
   //
   //
   //
   /** render */
   First,
   /** render */
   PreUpdate,
   /** render */
   Update,
   /** render */
   PostUpdate,
   /** render */
   Last,
   //
   //
   //
   FixedFirst,
   FixedPreUpdate,
   FixedUpdate,
   FixedPostUpdate,
   FixedLast,
   /** this is a custom update for deferred updating purely so we dont interfere with normal logic, should usually be last on a fixed update */
   FixedFlush,
}

export function is_fixed_schedule(schedule: Schedule): boolean {
   switch (schedule) {
      case Schedule.FixedFirst:
      case Schedule.FixedPreUpdate:
      case Schedule.FixedUpdate:
      case Schedule.FixedPostUpdate:
      case Schedule.FixedLast:
      case Schedule.FixedFlush: {
         return true;
      }

      default: {
         return false;
      }
   }
}

export function is_render_schedule(schedule: Schedule): boolean {
   switch (schedule) {
      case Schedule.First:
      case Schedule.PreUpdate:
      case Schedule.Update:
      case Schedule.PostUpdate:
      case Schedule.Last: {
         return true;
      }

      default: {
         return false;
      }
   }
}

export function is_startup_schedule(schedule: Schedule): boolean {
   switch (schedule) {
      case Schedule.PreStartup:
      case Schedule.Startup:
      case Schedule.PostStartup: {
         return true;
      }

      default: {
         return false;
      }
   }
}
