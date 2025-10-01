/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-logger-filter/src/constants.ts
 */

export const PLUGIN_NAME = 'builder-core-logger-filter';

// TODO: use this directly from the logger package instead?
export const LOG_LEVEL_MAP: ReadonlyMap<string, number> = new Map([
   ['trace', 1],
   ['debug', 2],
   ['info', 3],
   ['success', 3],
   ['warn', 4],
   ['error', 5],
   ['critical', 5],
   ['assert', 5],
]);

export const DEFAULT_LOG_FILTER_ENV_VAR = 'LOG_FILTERS';
export const DEFAULT_LOG_FILTER_DEFAULT_LEVEL = 'info';