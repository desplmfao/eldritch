/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-logger-filter/src/types.ts
 */

import type * as swc from '@swc/core';
import type { PackageInfo } from '@eldritch-engine/builder-core-logger-namespace/types';

export interface LogFilterRule {
   pattern: RegExp;
   level: number;
   original_pattern: string;
   original_level_string: string;
}

export interface LogFilterSettings {
   rules: LogFilterRule[];
   default_level_numeric: number;
}

export interface LogFilterTransformOptions {
   /** the original, untransformed source code string */
   source_code: string;
   /** absolute path to the file being processed, for context in errors/logs */
   absolute_file_path: string;
   /** information about the package the file belongs to (for base namespace derivation if needed) */
   package_info?: PackageInfo;
   /** root path of the project (for relative path calculation if needed) */
   project_root_path: string;
   /** parsed filter settings */
   filter_settings: LogFilterSettings;
   /** swc parsing options */
   parser_options: swc.ParseOptions;
   /** swc printing options (including source map config) */
   print_options: swc.Options;
   /** enable verbose logging from this module */
   verbose?: boolean;
}