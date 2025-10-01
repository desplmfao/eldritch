/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/inspector/index.ts
 */

import type { IBuildTimeRegistry } from '@eldritch-engine/type-utils/builder/registry';
import type { Pointer, SchemaLayout, PropertyLayout, IViewConstructor, IView } from '@eldritch-engine/type-utils/guerrero/index';
import type { IViewInspector, InspectedNode, InspectionOptions } from '@eldritch-engine/type-utils/guerrero/inspector';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { GLOBAL_NULL_POINTER, LITTLE_ENDIAN, POINTER_SIZE } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { TypeParser } from '@eldritch-engine/guerrero-core/layout/parser/parser';
import { align_offset } from '@eldritch-engine/guerrero-core/layout/calculator';
import { FIXED_PRIMITIVE_TYPE_DETAILS } from '@eldritch-engine/guerrero-core/layout/constants';

import { OFFSET_CAPACITY as OFFSET_CAPACITY_ARRAY, OFFSET_ELEMENTS_PTR, OFFSET_LENGTH } from '@self/runtime/skeletons/dynamic/array/dynamic-array'
import { OFFSET_CAPACITY_BUCKETS, OFFSET_COUNT as HASHMAP_OFFSET_COUNT, OFFSET_BUCKETS_PTR } from '@self/runtime/skeletons/dynamic/hashmap/dynamic-hashmap';
import { OFFSET_DENSE_PTR, OFFSET_SPARSE_PTR, OFFSET_COUNT as SPARSESET_OFFSET_COUNT } from '@self/runtime/skeletons/dynamic/dynamic-sparseset';


export class ViewInspectorAos implements IViewInspector {
   #registry: IBuildTimeRegistry;

   constructor(
      registry: IBuildTimeRegistry
   ) {
      this.#registry = registry;
   }

   inspect(
      buffer: ArrayBufferLike,
      pointer: Pointer,
      schema: SchemaLayout,
      allocator?: TlsfAllocator,
      options?: InspectionOptions
   ): InspectedNode {
      const name = schema.class_ctor?.name ?? schema.class_name ?? 'unknown';

      const root_node: InspectedNode = {
         name: name,
         type: name,
         offset: pointer,
         size: schema.total_size,
         value: `instance @0x${pointer.toString(16)}`,
         children: [],
      };

      this.#inspect_node_internal(root_node, buffer, pointer, schema, allocator, options);

      return root_node;
   }

   inspect_all_allocations(
      allocator: TlsfAllocator
   ): InspectedNode[] {
      /// #if SAFETY
      const registry = allocator.allocation_registry;

      if (!registry) {
         console.warn('cannot inspect all allocations: SAFETY build flag is enabled, but no AllocationRegistry was provided to the TlsfAllocator');

         return [];
      }

      const root_pointers = registry.get_root_pointers();
      const inspected_nodes: InspectedNode[] = [];

      for (const ptr of root_pointers) {
         const node = registry.get_node(ptr);

         if (node) {
            const schema = (node.owner as IViewConstructor).__schema;

            if (schema) {
               inspected_nodes.push(this.inspect(allocator.buffer, ptr, schema, allocator));
            }
         }
      }

      return inspected_nodes;

      // @ts-expect-error - this is valid due to the ifdef
      /// #else
      console.warn('inspect_all_allocations is only available in builds with the SAFETY flag enabled');

      return [];
      /// #endif
   }

   #inspect_node_internal(
      parent_node: InspectedNode,
      buffer: ArrayBufferLike,
      base_pointer: Pointer,
      schema: SchemaLayout,
      allocator?: TlsfAllocator,
      options?: InspectionOptions
   ): void {
      for (const prop_layout of schema.properties) {
         const prop_offset = base_pointer + prop_layout.offset;

         const child_node: InspectedNode = {
            name: String(prop_layout.property_key),
            type: prop_layout.type,
            offset: prop_offset,
            size: prop_layout.size,
            value: undefined,
            children: [],
         };

         this.#dispatch_property_inspection(child_node, prop_layout, buffer, base_pointer, allocator, options);

         parent_node.children!.push(child_node);
      }
   }

   #dispatch_property_inspection(
      node: InspectedNode,
      prop: PropertyLayout,
      buffer: ArrayBufferLike,
      base_ptr: Pointer,
      allocator?: TlsfAllocator,
      options?: InspectionOptions
   ): void {
      const view = new DataView(buffer);
      const prop_ptr = base_ptr + prop.offset;

      if (prop.bit_width != null && prop.bit_offset != null) {
         this.#inspect_bitfield(node, prop, view, prop_ptr);
      } else if (prop.binary_info.is_dynamic) {
         this.#inspect_dynamic_property(node, prop, view, prop_ptr, allocator, options);
      } else if (prop.binary_info.is_union) {
         this.#inspect_union(node, prop, buffer, prop_ptr, allocator, options);
      } else if (prop.binary_info.element_count != null) {
         this.#inspect_fixed_array(node, prop, buffer, prop_ptr, allocator, options);
      } else if (prop.binary_info.is_nested_struct) {
         this.#inspect_nested_struct(node, prop, buffer, prop_ptr, allocator, options);
      } else if (prop.binary_info.is_enum) {
         this.#inspect_enum(node, prop, view, prop_ptr);
      } else {
         this.#inspect_primitive(node, prop, view, prop_ptr);
      }
   }

   #inspect_primitive(
      node: InspectedNode,
      prop: PropertyLayout,
      view: DataView,
      ptr: Pointer
   ): void {
      const details = FIXED_PRIMITIVE_TYPE_DETAILS.get(prop.type);

      if (details) {
         // @ts-expect-error - getter string is valid
         const value = view[details.getter](ptr, details.needs_little_endian_arg ? LITTLE_ENDIAN : undefined);

         node.value = details.data_type === 'boolean' ? !!value : value;
      } else {
         node.value = `error: unknown primitive type '${prop.type}'`;
      }
   }

   #inspect_enum(
      node: InspectedNode,
      prop: PropertyLayout,
      view: DataView,
      ptr: Pointer
   ): void {
      const base_type = prop.enum_base_type ?? 'u8';
      const details = FIXED_PRIMITIVE_TYPE_DETAILS.get(base_type)!;

      // @ts-expect-error - getter string is valid
      const value = view[details.getter](ptr, details.needs_little_endian_arg ? LITTLE_ENDIAN : undefined);
      const member = prop.enum_members?.find(m => m.value === value);

      node.value = member ? `${member.name} (${value})` : `invalid enum value (${value})`;
   }

   #inspect_bitfield(
      node: InspectedNode,
      prop: PropertyLayout,
      view: DataView,
      ptr: Pointer
   ): void {
      const container_value = view.getUint32(ptr, LITTLE_ENDIAN);
      const value = (container_value >> prop.bit_offset!) & ((1 << prop.bit_width!) - 1);

      node.value = prop.type === 'bool' ? !!value : value;
   }

   #inspect_nested_struct(
      node: InspectedNode,
      prop: PropertyLayout,
      buffer: ArrayBufferLike,
      ptr: Pointer,
      allocator?: TlsfAllocator,
      options?: InspectionOptions
   ): void {
      const nested_schema = this.#registry.get_schema_layout(prop.type);

      if (nested_schema) {
         node.value = `struct @0x${ptr.toString(16)}`;

         this.#inspect_node_internal(node, buffer, ptr, nested_schema, allocator, options);
      } else {
         node.value = `error: schema not found for '${prop.type}'`;
      }
   }

   #inspect_union(
      node: InspectedNode,
      prop: PropertyLayout,
      buffer: ArrayBufferLike,
      ptr: Pointer,
      allocator?: TlsfAllocator,
      options?: InspectionOptions
   ): void {
      const view = new DataView(buffer);
      const tag = view.getUint8(ptr);
      const data_offset = align_offset(ptr + 1, prop.alignment);

      if (tag === 0) {
         node.value = undefined;

         return;
      }

      const variant = prop.variants?.find(v => v.tag === tag);
      if (!variant) {
         node.value = `error: unknown union tag '${tag}' for type '${prop.type}'`;

         return;
      }

      node.value = `variant '${variant.type_string}' (tag ${tag})`;

      const variant_prop_layout: PropertyLayout = {
         ...prop,
         type: variant.type_string,
         binary_info: variant.binary_info,
         offset: data_offset - ptr
      };

      this.#dispatch_property_inspection(node, variant_prop_layout, buffer, ptr, allocator, options);
   }

   #inspect_fixed_array(
      node: InspectedNode,
      prop: PropertyLayout,
      buffer: ArrayBufferLike,
      ptr: Pointer,
      allocator?: TlsfAllocator,
      options?: InspectionOptions
   ): void {
      const count = prop.binary_info.element_count!;
      const element_schema = prop.binary_info.element_schema!;
      const stride = element_schema.total_size;

      for (let i = 0; i < count; i++) {
         const element_ptr = ptr + i * stride;

         const child_node: InspectedNode = {
            name: `[${i}]`,
            type: prop.binary_info.element_type!,
            offset: element_ptr,
            size: stride,
            value: undefined,
            children: []
         };

         const element_prop_layout: PropertyLayout = {
            ...prop,
            type: prop.binary_info.element_type!,
            binary_info: {
               size: element_schema.total_size,
               alignment: element_schema.alignment,
               is_dynamic: element_schema.has_dynamic_data,
               has_dynamic_data: element_schema.has_dynamic_data,
               is_nested_struct: !!this.#registry.get_schema_layout(prop.binary_info.element_type!),
               is_ptr: element_schema.has_dynamic_data,
               element_schema: element_schema.properties[0]?.binary_info.element_schema,
               element_type: element_schema.properties[0]?.binary_info.element_type
            },
            offset: 0
         };

         this.#dispatch_property_inspection(child_node, element_prop_layout, buffer, element_ptr, allocator, options);

         node.children?.push(child_node);
      }
   }

   #inspect_dynamic_property(
      node: InspectedNode,
      prop: PropertyLayout,
      view: DataView,
      ptr: Pointer,
      allocator?: TlsfAllocator,
      options?: InspectionOptions
   ): void {
      if (!allocator) {
         node.value = 'error: allocator required to inspect dynamic types';

         return;
      }

      const control_ptr = view.getUint32(ptr, LITTLE_ENDIAN);

      node.value = `pointer @0x${control_ptr.toString(16)}`;

      if (control_ptr === 0) {
         if (prop.binary_info.is_optional) {
            node.value = undefined;
         }

         return;
      }

      const type_node = new TypeParser(prop.type).parse();

      switch (type_node.kind) {
         case 'primitive': { // str
            this.#inspect_dynamic_string_from_ptr(node, control_ptr, allocator);

            break;
         }

         case 'dynamic_array': {
            this.#inspect_dynamic_array_from_ptr(node, prop, control_ptr, allocator, options);

            break;
         }

         case 'map': {
            this.#inspect_map_from_ptr(node, prop, control_ptr, allocator, options);

            break;
         }

         case 'set': {
            this.#inspect_set_from_ptr(node, prop, control_ptr, allocator, options);

            break;
         }

         case 'sparseset': {
            this.#inspect_sparseset_from_ptr(node, prop, control_ptr, allocator, options);

            break;
         }

         default: {
            node.value += ` (unsupported dynamic type: ${type_node.kind})`;
         }
      }
   }

   #inspect_dynamic_string_from_ptr(
      node: InspectedNode,
      ptr: Pointer,
      allocator: TlsfAllocator
   ): void {
      // re-implementing DynamicString.value logic here to avoid instantiation
      const string_data_view = new DataView(allocator.buffer);
      const length = string_data_view.getUint32(ptr, LITTLE_ENDIAN);

      if (length > 0) {
         const string_bytes = new Uint8Array(allocator.buffer, ptr + 4, length);

         node.children?.push({
            name: 'value',
            type: 'string',
            offset: ptr,
            size: length + 4,
            value: new TextDecoder().decode(string_bytes)
         });
      } else {
         node.children?.push({
            name: 'value',
            type: 'string',
            offset: ptr,
            size: 4,
            value: ''
         });
      }
   }

   #inspect_dynamic_array_from_ptr(
      node: InspectedNode,
      prop: PropertyLayout,
      control_ptr: Pointer,
      allocator: TlsfAllocator,
      options?: InspectionOptions
   ): void {
      const control_view = new DataView(allocator.buffer);

      const length = control_view.getUint32(control_ptr + OFFSET_LENGTH, LITTLE_ENDIAN);
      const capacity = control_view.getUint32(control_ptr + OFFSET_CAPACITY_ARRAY, LITTLE_ENDIAN);
      const elements_ptr = control_view.getUint32(control_ptr + OFFSET_ELEMENTS_PTR, LITTLE_ENDIAN);

      node.total_children_count = length;

      node.children?.push(
         {
            name: 'length',
            type: 'u32',
            offset: control_ptr + OFFSET_LENGTH,
            size: 4,
            value: length
         },
         {
            name: 'capacity',
            type: 'u32',
            offset: control_ptr + OFFSET_CAPACITY_ARRAY,
            size: 4,
            value: capacity
         },
         {
            name: 'elements_ptr',
            type: 'Pointer',
            offset: control_ptr + OFFSET_ELEMENTS_PTR,
            size: 4,
            value: `@0x${elements_ptr.toString(16)}`
         }
      );

      if (
         length === 0
         || elements_ptr === 0
      ) {
         return;
      }

      const element_schema = prop.binary_info.element_schema!;
      const stride = element_schema.total_size;
      const start_index = options?.pagination?.start_index ?? 0;
      const count = options?.pagination?.count ?? 100;
      const end_index = Math.min(length, start_index + count);

      for (let i = start_index; i < end_index; i++) {
         const element_ptr = elements_ptr + i * stride;

         const child_node: InspectedNode = {
            name: `[${i}]`,
            type: prop.binary_info.element_type!,
            offset: element_ptr,
            size: stride,
            value: undefined,
            children: []
         };

         const element_prop_layout: PropertyLayout = {
            ...prop,
            type: prop.binary_info.element_type!,
            binary_info: {
               size: element_schema.total_size,
               alignment: element_schema.alignment,
               is_dynamic: element_schema.has_dynamic_data,
               has_dynamic_data: element_schema.has_dynamic_data,
               is_nested_struct: !!this.#registry.get_schema_layout(prop.binary_info.element_type!),
               is_ptr: element_schema.has_dynamic_data,
               element_schema: element_schema.properties[0]?.binary_info.element_schema,
               element_type: element_schema.properties[0]?.binary_info.element_type
            },
            offset: 0
         };

         this.#dispatch_property_inspection(child_node, element_prop_layout, allocator.buffer, element_ptr, allocator, options);

         node.children?.push(child_node);
      }
   }

   #inspect_map_from_ptr(
      node: InspectedNode,
      prop: PropertyLayout,
      control_ptr: Pointer,
      allocator: TlsfAllocator,
      options?: InspectionOptions
   ): void {
      const control_view = new DataView(allocator.buffer);
      const size = control_view.getUint32(control_ptr + HASHMAP_OFFSET_COUNT, LITTLE_ENDIAN);
      const capacity = control_view.getUint32(control_ptr + OFFSET_CAPACITY_BUCKETS, LITTLE_ENDIAN);
      const buckets_ptr = control_view.getUint32(control_ptr + OFFSET_BUCKETS_PTR, LITTLE_ENDIAN);

      node.total_children_count = size;

      node.children?.push(
         {
            name: 'size',
            type: 'u32',
            offset: control_ptr + HASHMAP_OFFSET_COUNT,
            size: 4,
            value: size
         },
         {
            name: 'capacity',
            type: 'u32',
            offset: control_ptr + OFFSET_CAPACITY_BUCKETS,
            size: 4,
            value: capacity
         }
      );

      if (
         size === 0
         || buckets_ptr === 0
      ) {
         return;
      }

      const key_type_string = prop.binary_info.key_type!;
      const resolved_key_type = this.#registry.resolver.resolve(key_type_string);
      const key_binary_info = resolved_key_type.binary_type_info;

      const value_type_string = prop.binary_info.element_type!;
      const resolved_value_type = this.#registry.resolver.resolve(value_type_string);
      const value_binary_info = resolved_value_type.binary_type_info;

      const key_prop_layout: PropertyLayout = {
         property_key: 'key',
         order: 0,
         type: key_type_string,
         offset: 0,
         size: key_binary_info.size,
         alignment: key_binary_info.alignment,
         binary_info: key_binary_info
      } as PropertyLayout;

      const value_prop_layout: PropertyLayout = {
         property_key: 'value',
         order: 1,
         type: value_type_string,
         offset: 0,
         size: value_binary_info.size,
         alignment: value_binary_info.alignment,
         binary_info: value_binary_info,
      } as PropertyLayout;

      const start_index = options?.pagination?.start_index ?? 0;
      const count = options?.pagination?.count ?? 100;

      let current_index = 0;
      let items_added = 0;

      for (let i = 0; i < capacity && items_added < count; i++) {
         let current_node_ptr = control_view.getUint32(buckets_ptr + i * POINTER_SIZE, LITTLE_ENDIAN);

         while (current_node_ptr !== 0 && items_added < count) {
            if (current_index >= start_index) {
               const entry_node: InspectedNode = {
                  name: `[${current_index}]`,
                  type: 'map_entry',
                  offset: current_node_ptr,
                  size: 0,
                  value: undefined,
                  children: []
               };

               const key_ptr = control_view.getUint32(current_node_ptr + POINTER_SIZE, LITTLE_ENDIAN);
               const key_node: InspectedNode = {
                  name: 'key',
                  type: key_prop_layout.type,
                  offset: key_ptr,
                  size: key_prop_layout.size,
                  value: undefined,
                  children: []
               };

               if (key_prop_layout.type === 'str') {
                  key_node.value = `pointer @0x${key_ptr.toString(16)}`;

                  if (key_ptr !== GLOBAL_NULL_POINTER) {
                     this.#inspect_dynamic_string_from_ptr(key_node, key_ptr, allocator);
                  }
               } else {
                  this.#dispatch_property_inspection(key_node, key_prop_layout, allocator.buffer, current_node_ptr, allocator, options);
               }

               entry_node.children!.push(key_node);

               const value_ptr = current_node_ptr + POINTER_SIZE * 2;
               const value_node: InspectedNode = {
                  name: 'value',
                  type: value_prop_layout.type,
                  offset: value_ptr,
                  size: value_prop_layout.size,
                  value: undefined,
                  children: []
               };

               this.#dispatch_property_inspection(value_node, value_prop_layout, allocator.buffer, current_node_ptr, allocator, options);
               entry_node.children!.push(value_node);

               node.children?.push(entry_node);
               items_added++;
            }

            current_index++;
            current_node_ptr = control_view.getUint32(current_node_ptr, LITTLE_ENDIAN);
         }
      }
   }

   #inspect_set_from_ptr(
      node: InspectedNode,
      prop: PropertyLayout,
      control_ptr: Pointer,
      allocator: TlsfAllocator,
      options?: InspectionOptions
   ): void {
      const control_view = new DataView(allocator.buffer);
      const size = control_view.getUint32(control_ptr + HASHMAP_OFFSET_COUNT, LITTLE_ENDIAN);
      const capacity = control_view.getUint32(control_ptr + OFFSET_CAPACITY_BUCKETS, LITTLE_ENDIAN);
      const buckets_ptr = control_view.getUint32(control_ptr + OFFSET_BUCKETS_PTR, LITTLE_ENDIAN);

      node.total_children_count = size;

      node.children?.push(
         {
            name: 'size',
            type: 'u32',
            offset: control_ptr + HASHMAP_OFFSET_COUNT,
            size: 4,
            value: size
         },
         {
            name: 'capacity',
            type: 'u32',
            offset: control_ptr + OFFSET_CAPACITY_BUCKETS,
            size: 4,
            value: capacity
         }
      );

      if (
         size === 0
         || buckets_ptr === 0
      ) {
         return;
      }

      const element_schema = prop.binary_info.element_schema!;

      const element_prop_layout: PropertyLayout = {
         ...prop,
         type: element_schema.class_name!,
         size: element_schema.total_size,
         alignment: element_schema.alignment,
         offset: 0,
         binary_info: {
            ...element_schema,
            size: 0
         }
      };

      const start_index = options?.pagination?.start_index ?? 0;
      const count = options?.pagination?.count ?? 100;

      let current_index = 0;
      let items_added = 0;

      for (let i = 0; i < capacity && items_added < count; i++) {
         let current_node_ptr = control_view.getUint32(buckets_ptr + i * POINTER_SIZE, LITTLE_ENDIAN);

         while (current_node_ptr !== 0 && items_added < count) {
            if (current_index >= start_index) {
               const key_ptr = control_view.getUint32(current_node_ptr + POINTER_SIZE, LITTLE_ENDIAN);

               const child_node: InspectedNode = {
                  name: `[${current_index}]`,
                  type: element_prop_layout.type,
                  offset: key_ptr,
                  size: POINTER_SIZE,
                  value: undefined,
                  children: []
               };

               this.#dispatch_property_inspection(child_node, element_prop_layout, allocator.buffer, key_ptr, allocator, options);

               node.children?.push(child_node);
               items_added++;
            }

            current_index++;
            current_node_ptr = control_view.getUint32(current_node_ptr, LITTLE_ENDIAN);
         }
      }
   }

   #inspect_sparseset_from_ptr(
      node: InspectedNode,
      prop: PropertyLayout,
      control_ptr: Pointer,
      allocator: TlsfAllocator,
      options?: InspectionOptions
   ): void {
      const control_view = new DataView(allocator.buffer);
      const count = control_view.getUint32(control_ptr + SPARSESET_OFFSET_COUNT, LITTLE_ENDIAN);
      const dense_ptr_location = control_ptr + OFFSET_DENSE_PTR;
      const sparse_ptr_location = control_ptr + OFFSET_SPARSE_PTR;
      const dense_control_ptr = control_view.getUint32(dense_ptr_location, LITTLE_ENDIAN);
      const sparse_control_ptr = control_view.getUint32(sparse_ptr_location, LITTLE_ENDIAN);

      node.total_children_count = count;

      node.children?.push(
         {
            name: 'size',
            type: 'u32',
            offset: control_ptr + SPARSESET_OFFSET_COUNT,
            size: 4,
            value: count
         },
         {
            name: 'dense_array_ptr',
            type: 'Pointer',
            offset: dense_ptr_location,
            size: 4,
            value: `@0x${dense_control_ptr.toString(16)}`
         },
         {
            name: 'sparse_array_ptr',
            type: 'Pointer',
            offset: sparse_ptr_location,
            size: 4,
            value: `@0x${sparse_control_ptr.toString(16)}`
         }
      );

      const u32_schema = this.#registry.resolver.resolve('u32').schema_layout!;

      const array_prop_layout: PropertyLayout = {
         ...prop,
         type: 'u32[]',
         binary_info: {
            ...prop.binary_info,
            element_type: 'u32',
            element_schema: u32_schema,
         }
      };

      const dense_node: InspectedNode = {
         name: 'elements',
         type: 'u32[]',
         offset: dense_ptr_location,
         size: 4,
         value: '...',
         children: []
      };

      this.#inspect_dynamic_array_from_ptr(dense_node, array_prop_layout, dense_control_ptr, allocator, options);

      node.children?.push(dense_node);
   }
}