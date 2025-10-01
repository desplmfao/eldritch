/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-unplugin/src/log_levels.ts
 */

export const LOG_LEVEL_HIERARCHY: ReadonlyMap<string, number> = new Map([
   ['trace', 1],
   ['debug', 2],
   ['info', 3],
   ['success', 3],
   ['warn', 4],
   ['error', 5],
   ['critical', 5],
   ['assert', 5],
]);

export const ALL_LOG_LEVELS = [
   'TRACE',
   'DEBUG',
   'INFO',
   'SUCCESS',
   'WARN',
   'ERROR',
   'CRITICAL',
   'ASSERT',
] as const;