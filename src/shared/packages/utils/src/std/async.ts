/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/utils/src/std/async.ts
 */

/**
 * creates a promise that resolves after a specified number of milliseconds
 */
export function delay(ms: number): Promise<void> {
   return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * creates a debounced function that delays invoking `func` until after `wait`
 * milliseconds have elapsed since the last time the debounced function was invoked
 */
export function debounce<T extends (...args: any[]) => any>(
   func: T,
   wait: number
): (...args: Parameters<T>) => void {
   let timeout: ReturnType<typeof setTimeout> | null = null;
   return function (...args: Parameters<T>) {
      if (timeout) {
         clearTimeout(timeout);
      }

      timeout = setTimeout(() => {
         func(...args);
      }, wait);
   };
}

/**
 * creates a throttled function that only invokes `func` at most once per every `limit` milliseconds
 */
export function throttle<T extends (...args: any[]) => any>(
   func: T,
   limit: number
): (...args: Parameters<T>) => void {
   let in_throttle = false;
   return function (...args: Parameters<T>) {
      if (!in_throttle) {
         func(...args);
         in_throttle = true;
         setTimeout(() => (in_throttle = false), limit);
      }
   };
}