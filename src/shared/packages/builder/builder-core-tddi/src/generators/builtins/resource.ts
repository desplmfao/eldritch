/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-tddi/src/generators/builtins/resource.ts
 */

import type * as swc from '@swc/core';

import { injection_type } from '@eldritch-engine/ecs-core/reflect/builtins/resource';

import type { ImportInfo, ResMetadata } from '@eldritch-engine/type-utils/tddi/index';
import type { IInjectionGenerator } from '@eldritch-engine/type-utils/tddi/generator';

export class ResourceGenerator implements IInjectionGenerator {
   readonly marker_name = 'Res';

   generate_metadata(
      type_node: swc.TsTypeReference,
      param_index: number,
      import_map: Map<string, ImportInfo>
   ): ResMetadata | undefined {
      if (
         !type_node.typeParams
         || type_node.typeParams.params.length !== 1
      ) {
         return;
      }

      let resource_type_node = type_node.typeParams.params[0]!;
      let is_readonly = false;

      if (
         resource_type_node.type === 'TsTypeReference'
         && resource_type_node.typeName.type === 'Identifier'
         && resource_type_node.typeName.value === 'Readonly'
      ) {
         is_readonly = true;

         if (
            resource_type_node.typeParams
            && resource_type_node.typeParams.params.length === 1
         ) {
            resource_type_node = resource_type_node.typeParams.params[0]!;
         } else {
            return;
         }
      }

      if (
         resource_type_node.type === 'TsTypeReference'
         && resource_type_node.typeName.type === 'Identifier'
      ) {
         const resource_ctor = resource_type_node.typeName.value;

         return {
            injection_type,
            marker_type_name: this.marker_name,
            resource_ctor,
            is_readonly,
         };
      }

      return;
   }
}