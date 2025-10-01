/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-tddi/src/swc/visitor.ts
 */

import { Visitor } from '@swc/core/Visitor.js';
import type * as swc from '@swc/core';

import type { FileTDDIMetadata, ImportInfo, MethodTDDIMetadata, TDDIMetadata } from '@eldritch-engine/type-utils/tddi/index';
import type { IInjectionGenerator } from '@eldritch-engine/type-utils/tddi/generator';

import { InjectionGeneratorRegistry } from '@self/generators/registry';

export const TDDI_MARKER_PROP_NAME = '__tddi';

export class TDDIVisitor extends Visitor {
   #file_metadata: FileTDDIMetadata = {};
   #import_map: Map<string, ImportInfo>;
   #generator_registry: InjectionGeneratorRegistry;
   #valid_tddi_marker_names: ReadonlySet<string>;
   #current_class_name?: string;

   constructor(
      import_map: Map<string, ImportInfo>,
      valid_tddi_marker_names: ReadonlySet<string>,
      custom_generators?: IInjectionGenerator[]
   ) {
      super();

      this.#import_map = import_map;
      this.#valid_tddi_marker_names = valid_tddi_marker_names;
      this.#generator_registry = new InjectionGeneratorRegistry(custom_generators);
   }

   get_collected_metadata(): Readonly<FileTDDIMetadata> {
      return this.#file_metadata;
   }

   override visitClassDeclaration(
      decl: swc.ClassDeclaration
   ): swc.ClassDeclaration {
      if (
         decl.superClass
         && decl.superClass.type === 'Identifier'
      ) {
         this.#current_class_name = decl.identifier.value;

         if (!this.#file_metadata[this.#current_class_name]) {
            this.#file_metadata[this.#current_class_name] = {};
         }

         super.visitClassDeclaration(decl);

         this.#current_class_name = undefined;
      }

      return decl;
   }

   override visitClassMethod(method: swc.ClassMethod): swc.ClassMethod {
      if (
         this.#current_class_name
         && method.key.type === 'Identifier'
      ) {
         const method_name = method.key.value;
         const method_metadata: MethodTDDIMetadata = {};

         let has_any_tddi_params = false;

         for (let i = 0; i < method.function.params.length; i++) {
            const param = method.function.params[i]!;

            const pat = param.pat as swc.BindingIdentifier;

            if (
               pat.type === 'Identifier'
               && pat.typeAnnotation
            ) {
               const type_annotation_node = pat.typeAnnotation.typeAnnotation;

               const injection_metadata = this.#process_parameter(type_annotation_node, i);

               if (injection_metadata) {
                  method_metadata[i] = injection_metadata;

                  has_any_tddi_params = true;
               }
            }
         }

         if (has_any_tddi_params) {
            this.#file_metadata[this.#current_class_name]![method_name] = method_metadata;
         }
      }

      return method;
   }

   #process_parameter(
      type_node: swc.TsType,
      param_index: number
   ): TDDIMetadata | undefined {
      if (
         type_node.type === 'TsTypeReference'
         && type_node.typeName.type === 'Identifier'
      ) {
         const marker_name = type_node.typeName.value;

         if (!this.#valid_tddi_marker_names.has(marker_name)) {
            return;
         }

         const generator = this.#generator_registry.get(marker_name);

         if (generator) {
            return generator.generate_metadata(type_node, param_index, this.#import_map);
         }
      } else if (type_node.type === 'TsIntersectionType') {
         for (const t of type_node.types) {
            if (
               t.type === 'TsTypeReference'
               && t.typeName.type === 'Identifier'
            ) {
               const marker_name = t.typeName.value;

               if (this.#valid_tddi_marker_names.has(marker_name)) {
                  const generator = this.#generator_registry.get(marker_name);

                  if (generator) {
                     return generator.generate_metadata(t, param_index, this.#import_map);
                  }
               }
            }
         }
      }

      return;
   }

   override visitTsType(
      node: swc.TsType
   ): swc.TsType {
      return node;
   }
}