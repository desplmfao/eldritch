/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/type-utils/src/tddi/generator.ts
 */

import type * as swc from '@swc/core';

import type { ImportInfo, TDDIMetadata } from '@self/tddi/index';

export interface IInjectionGenerator {
   /** the name of the marker type this generator handles */
   readonly marker_name: string;

   /** generates the metadata object for an injection */
   generate_metadata(
      type_node: swc.TsTypeReference,
      param_index: number,
      import_map: Map<string, ImportInfo>,
      dependency_set?: Set<string>
   ): TDDIMetadata | undefined;
}