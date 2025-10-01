/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-logger-namespace/src/types.ts
 */

/** information about the package containing a processed file */
export interface PackageInfo {
   /** the name of the package (e.g., @scope/package-name) */
   name: string;
   /** the absolute path to the root directory of the package */
   root_path: string;
}