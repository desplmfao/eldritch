/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/utils/src/std/guards.ts
 */

/**
 * type guard to filter out null and undefined values from an array
 * while correctly narrowing the type
 *
 * @example
 * const values: (string | null)[] = ["a", null, "b"];
 * const strings: string[] = values.filter(is_not_null); // ["a", "b"]
 */
export function is_not_null<T>(value: T | null | undefined): value is T {
   return value != null;
}