/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/utils/src/std/timer.ts
 */

/** a simple timer class to track remaining time over a duration */
export class Timer {
   /** the remaining time on the timer */
   time_remaining: number;

   /** the total duration of the timer in the same units as delta_time */
   duration: number;

   /** checks if the timer has finished (time remaining is 0) */
   get is_finished(): boolean {
      return this.time_remaining <= 0;
   }

   /**
    * creates a new timer
    * 
    * @param duration - the total duration of the timer in the same units as delta_time (e.g., seconds)
    */
   constructor(duration: number) {
      this.time_remaining = duration;
      this.duration = duration;
   }

   /**
    * advances the timer by a delta time
    * 
    * @param delta_time - the amount of time that has passed since the last tick
    */
   tick(delta_time: number): void {
      if (this.time_remaining > 0) {
         this.time_remaining -= delta_time;

         if (this.time_remaining < 0) {
            this.time_remaining = 0;
         }
      }
   }

   /** resets the timer back to its initial duration */
   reset(): void {
      this.time_remaining = this.duration;
   }

   /** sets the timer as finished immediately */
   finish(): void {
      this.time_remaining = 0;
   }

   /** changes the duration and resets the timer */
   set_duration(new_duration: number): void {
      this.duration = new_duration;
      this.reset();
   }
}
