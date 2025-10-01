/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-tddi/src/generators/builtins/local.ts
 */

import type * as swc from '@swc/core';

import { injection_type } from '@eldritch-engine/ecs-core/reflect/builtins/local';

import type { ImportInfo, LocalMetadata } from '@eldritch-engine/type-utils/tddi/index';
import type { IInjectionGenerator } from '@eldritch-engine/type-utils/tddi/generator';

export class LocalGenerator implements IInjectionGenerator {
   readonly marker_name = 'Local';

   generate_metadata(
      type_node: swc.TsTypeReference,
      param_index: number,
      import_map: Map<string, ImportInfo>
   ): LocalMetadata | undefined {
      if (
         !type_node.typeParams
         || type_node.typeParams.params.length !== 1
      ) {
         return;
      }

      const local_type_node = type_node.typeParams.params[0]!;

      if (
         local_type_node.type === 'TsTypeReference'
         && local_type_node.typeName.type === 'Identifier'
      ) {
         const local_type_name = local_type_node.typeName.value;

         const property_name = `#__${local_type_name}`;

         return {
            injection_type,
            marker_type_name: this.marker_name,
            property_name: property_name
         };
      }

      return;
   }
}