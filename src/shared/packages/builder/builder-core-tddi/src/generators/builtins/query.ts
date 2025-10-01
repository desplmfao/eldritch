/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-tddi/src/generators/builtins/query.ts
 */

import type * as swc from '@swc/core';

import { injection_type } from '@eldritch-engine/ecs-core/reflect/builtins/query';

import type { ImportInfo, QueryComponentInfo, QueryFilterInfo, QueryMetadata } from '@eldritch-engine/type-utils/tddi/index';
import type { IInjectionGenerator } from '@eldritch-engine/type-utils/tddi/generator';


export class QueryGenerator implements IInjectionGenerator {
   readonly marker_name = 'Query';

   generate_metadata(
      type_node: swc.TsTypeReference,
      param_index: number,
      import_map: Map<string, ImportInfo>
   ): QueryMetadata | undefined {
      if (
         !type_node.typeParams
         || type_node.typeParams.params.length === 0
         || type_node.typeParams.params.length > 2
      ) {
         return;
      }

      const components_node = type_node.typeParams.params[0]!;
      const filters_node = type_node.typeParams.params[1];

      let components: QueryComponentInfo[] | undefined;

      if (components_node.type === 'TsTupleType') {
         components = this.#parse_component_tuple(components_node);
      } else if (components_node.type === 'TsTypeReference') {
         components = this.#parse_component_reference(components_node);
      } else {
         return;
      }

      const filters = filters_node ? this.#parse_filter_tuple(filters_node) : [];

      if (!components) {
         return;
      }

      return {
         injection_type,
         marker_type_name: this.marker_name,
         components,
         filters
      };
   }

   #parse_component_tuple(node: swc.TsType): QueryComponentInfo[] | undefined {
      if (node.type !== 'TsTupleType') {
         return;
      }

      const components: QueryComponentInfo[] = [];

      for (const element of node.elemTypes) {
         let type_ref = element.ty;
         let is_readonly = false;

         if (
            type_ref.type === 'TsTypeReference'
            && type_ref.typeName.type === 'Identifier'
            && type_ref.typeName.value === 'Readonly'
         ) {
            is_readonly = true;

            if (
               type_ref.typeParams
               && type_ref.typeParams.params.length === 1
            ) {
               type_ref = type_ref.typeParams.params[0]!;
            } else {
               return;
            }
         }

         if (
            type_ref.type === 'TsTypeReference'
            && type_ref.typeName.type === 'Identifier'
         ) {
            components.push(
               {
                  component_ctor: type_ref.typeName.value,
                  is_readonly
               }
            );
         } else {
            return;
         }
      }

      return components;
   }

   #parse_component_reference(node: swc.TsType): QueryComponentInfo[] | undefined {
      let type_ref = node;
      let is_readonly = false;

      if (
         type_ref.type === 'TsTypeReference'
         && type_ref.typeName.type === 'Identifier'
         && type_ref.typeName.value === 'Readonly'
      ) {
         is_readonly = true;

         if (
            type_ref.typeParams
            && type_ref.typeParams.params.length === 1
         ) {
            type_ref = type_ref.typeParams.params[0]!;
         } else {
            return;
         }
      }

      if (
         type_ref.type === 'TsTypeReference'
         && type_ref.typeName.type === 'Identifier'
      ) {
         return [
            {
               component_ctor: type_ref.typeName.value,
               is_readonly
            }
         ];
      }

      return;
   }

   #parse_filter_components(node: swc.TsType): string[] {
      const component_ctors: string[] = [];

      if (
         node.type === 'TsTypeReference'
         && node.typeName.type === 'Identifier'
      ) {
         component_ctors.push(node.typeName.value);
      }

      else if (node.type === 'TsTupleType') {
         for (const comp_node of node.elemTypes) {
            if (
               comp_node.ty.type === 'TsTypeReference'
               && comp_node.ty.typeName.type === 'Identifier'
            ) {
               component_ctors.push(comp_node.ty.typeName.value);
            }
         }
      }
      return component_ctors;
   }

   #parse_filter_tuple(node: swc.TsType): QueryFilterInfo[] {
      if (node.type !== 'TsTupleType') {
         return [];
      }

      const filters: QueryFilterInfo[] = [];

      for (const element of node.elemTypes) {
         if (
            element.ty.type === 'TsTypeReference'
            && element.ty.typeName.type === 'Identifier'
         ) {
            const filter_type = element.ty.typeName.value;

            if (
               filter_type === 'With'
               || filter_type === 'Without'
            ) {
               if (
                  element.ty.typeParams
                  && element.ty.typeParams.params.length === 1
               ) {
                  const inner_node = element.ty.typeParams.params[0]!;

                  const component_ctors = this.#parse_filter_components(inner_node);

                  if (component_ctors.length > 0) {
                     filters.push({ filter_type, component_ctors });
                  }
               }
            }
         }
      }

      return filters;
   }
}