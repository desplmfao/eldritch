/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/src/layout/calculator.ts
 */

import type { MetadataClassExtracted, PropertyLayout, SchemaLayout, Pointer } from '@eldritch-engine/type-utils/guerrero/index';

import type { IBuildTimeRegistry } from '@eldritch-engine/type-utils/builder/registry';
import type { ITypeResolver } from '@eldritch-engine/type-utils/builder/resolver';

import { ALIGN_SIZE } from '@self/runtime/allocator/constants';

export function align_offset(
   offset: Pointer,
   alignment: number
): Pointer {
   return (offset + (alignment - 1)) & ~(alignment - 1);
}

export class SchemaLayoutCalculator {
   registry: IBuildTimeRegistry;
   resolver: ITypeResolver;

   currently_calculating = new Set<string>();

   constructor(
      registry: IBuildTimeRegistry,
      resolver: ITypeResolver
   ) {
      this.registry = registry;
      this.resolver = resolver;
   }

   calculate_schema_layout(
      class_name: string,
      class_metadata: MetadataClassExtracted
   ): SchemaLayout {
      this.currently_calculating.add(class_name);

      try {
         const sorted_properties = [...class_metadata.properties].sort((a, b) => a.order - b.order);
         const property_layouts: PropertyLayout[] = [];
         let current_offset: Pointer = 0;
         let max_alignment: number = 0;
         let has_dynamic_data_overall = false;

         if (
            class_metadata.alias_for
            && class_metadata.alias_mode === 'extend'
         ) {
            const resolved_base = this.resolver.resolve(class_metadata.alias_for);
            const base_info = resolved_base.binary_type_info;

            current_offset = base_info.size;
            max_alignment = base_info.alignment;
            has_dynamic_data_overall = base_info.has_dynamic_data ?? false;
         }

         let is_packing_bits = false;
         let bitfield_container_offset = 0;
         let bits_used_in_container = 0;

         const BITS_IN_CONTAINER = 32;
         const BITFIELD_CONTAINER_SIZE = 4;
         const BITFIELD_CONTAINER_ALIGNMENT = 4;

         const finalize_bitfield = () => {
            if (is_packing_bits) {
               current_offset = bitfield_container_offset + BITFIELD_CONTAINER_SIZE;
               is_packing_bits = false;
            }
         };

         for (const prop_meta of sorted_properties) {
            if (
               'process' in global
               && process.env['VERBOSE_BT'] === 'true'
            ) {
               const prop_name = String(prop_meta.property_key);

               console.info(`resolving '${class_name}.${prop_name}' with type string: '${prop_meta.type}'`);
            }

            const resolved_type = this.resolver.resolve(prop_meta.type, prop_meta.is_optional ?? false, prop_meta);
            const binary_info = resolved_type.binary_type_info;

            const is_packable = prop_meta.type === 'bool'
               || prop_meta.bits != null;

            if (is_packable) {
               if (!is_packing_bits) {
                  is_packing_bits = true;
                  max_alignment = Math.max(max_alignment, BITFIELD_CONTAINER_ALIGNMENT);
                  bitfield_container_offset = align_offset(current_offset, BITFIELD_CONTAINER_ALIGNMENT);
                  bits_used_in_container = 0;
               }

               const bit_width = prop_meta.bits ?? 1;

               if (bits_used_in_container + bit_width > BITS_IN_CONTAINER) {
                  finalize_bitfield();

                  is_packing_bits = true;
                  max_alignment = Math.max(max_alignment, BITFIELD_CONTAINER_ALIGNMENT);
                  bitfield_container_offset = align_offset(current_offset, BITFIELD_CONTAINER_ALIGNMENT);
                  bits_used_in_container = 0;
               }

               const final_prop_layout: PropertyLayout = {
                  ...prop_meta,
                  offset: bitfield_container_offset,
                  size: BITFIELD_CONTAINER_SIZE,
                  alignment: BITFIELD_CONTAINER_ALIGNMENT,
                  binary_info: {
                     ...binary_info,
                     size: BITFIELD_CONTAINER_SIZE,
                     alignment: BITFIELD_CONTAINER_ALIGNMENT,
                     bit_offset: bits_used_in_container,
                     bit_width: bit_width,
                  },
                  bit_offset: bits_used_in_container,
                  bit_width: bit_width,
               };

               bits_used_in_container += bit_width;

               property_layouts.push(final_prop_layout);
            } else {
               finalize_bitfield();

               const actual_prop_alignment = binary_info.alignment;
               current_offset = align_offset(current_offset, actual_prop_alignment);

               const actual_prop_offset = current_offset;
               const actual_prop_size = binary_info.size;
               current_offset += actual_prop_size;

               max_alignment = Math.max(max_alignment, actual_prop_alignment);

               if (binary_info.has_dynamic_data) {
                  has_dynamic_data_overall = true;
               }

               const final_prop_layout: PropertyLayout = {
                  ...prop_meta,
                  offset: actual_prop_offset,
                  size: actual_prop_size,
                  alignment: actual_prop_alignment,
                  binary_info: binary_info,
                  variants: binary_info.variants,
               };

               if (binary_info.is_enum) {
                  const enum_meta = this.registry.get_class_metadata(prop_meta.type);

                  final_prop_layout.enum_members = enum_meta?.enum_members;
               }

               property_layouts.push(final_prop_layout);
            }
         }

         finalize_bitfield();

         if (
            max_alignment === 0
            && sorted_properties.length > 0
         ) {
            max_alignment = 1;
         } else if (max_alignment === 0) {
            max_alignment = ALIGN_SIZE;
         }

         const total_size = align_offset(current_offset, max_alignment);

         return {
            class_name,
            total_size,
            alignment: max_alignment,
            properties: property_layouts,
            has_dynamic_data: has_dynamic_data_overall,
         };
      } finally {
         this.currently_calculating.delete(class_name);
      }
   }
}