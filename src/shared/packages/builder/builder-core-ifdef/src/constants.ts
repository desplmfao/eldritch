/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-ifdef/src/constants.ts
 */

export const REG_EXPS = {
   triple: /^\s*\/\/\/[\s]*#(?<token>\S+)(?:[\s]+(?<expression>.*?))?[\s]*$/,
} as const;

export const PLUGIN_NAME: string = 'builder-core-ifdef';
export const DEFAULT_COMMENT_PREFIX: string = '// ';