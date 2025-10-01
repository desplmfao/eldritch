/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/codegen/propgen/collections/hashmap/index.ts
 */

import type { PropertyLayout, SchemaLayout, UnionVariantMetadata } from '@eldritch-engine/type-utils/guerrero/index';
import type { ICodegenStrategy, IPropertyCodegen } from '@eldritch-engine/type-utils/guerrero/codegen';
import type { TypeNode, MapTypeNode } from '@eldritch-engine/type-utils/guerrero/parser';

import { TypeParser, stringify_type_node } from '@eldritch-engine/guerrero-core/layout/parser/parser';
import { generate_schema_layout_code, sanitize_type_for_name } from '@eldritch-engine/guerrero-core/utils/schema';
import { FIXED_PRIMITIVE_TYPE_DETAILS, FIXED_PRIMITIVE_TYPES } from '@eldritch-engine/guerrero-core/layout/constants';
import { POINTER_SIZE } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

export class DynamicHashMapPropgen implements IPropertyCodegen {

   can_handle(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): boolean {
      return (property_layout.binary_info.is_dynamic ?? false)
         && new TypeParser(property_layout.type).parse().kind === 'map';
   }

   get_required_imports(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): Set<string> {
      const key_type = property_layout.binary_info.key_type;
      const value_type = property_layout.binary_info.element_type;

      if (!key_type || !value_type) {
         return new Set();
      }

      const imports = new Set<string>();

      imports.add('POINTER_SIZE');
      imports.add('IViewConstructor');
      imports.add('TlsfAllocator');
      imports.add('PrimitiveView');

      if (key_type === 'str') {
         if (value_type === 'str') {
            imports.add('DynamicHashMapStringString');
         } else if (FIXED_PRIMITIVE_TYPES.has(value_type)) {
            imports.add('DynamicHashMapStringPrimitive');
            imports.add('DynamicString');
         } else {
            imports.add('DynamicHashMapStringOf');
            imports.add(value_type);
         }
      } else if (FIXED_PRIMITIVE_TYPES.has(key_type)) {
         if (value_type === 'str') {
            imports.add('DynamicHashMapPrimitiveString');
            imports.add('DynamicString');
         } else if (FIXED_PRIMITIVE_TYPES.has(value_type)) {
            imports.add('DynamicHashMapPrimitivePrimitive');
         } else {
            imports.add('DynamicHashMapPrimitiveOf');
            imports.add(value_type);
         }
      }

      return imports;
   }

   generate_private_view_field(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string {
      const prop_key_str = String(property_layout.property_key);
      const private_prop_name = `#${prop_key_str}_view`;

      const view_type_info = strategy.get_or_generate_view_and_schema_for_type(property_layout.type);

      return `\
   ${private_prop_name}?: ${view_type_info.class_name};
`;
   }

   can_handle_as_standalone(
      type_node: TypeNode
   ): boolean {
      return type_node.kind === 'map';
   }

   generate_standalone_view_class(
      strategy: ICodegenStrategy,
      type_node: TypeNode,
      class_name: string
   ): {
      code: string;
      imports: Set<string>;
      schema: SchemaLayout;
      internal_dependencies: Set<string>;
   } {
      const map_node = type_node as MapTypeNode;
      const key_type_node = map_node.key_type;
      const value_type_node = map_node.value_type;
      const key_type_str = stringify_type_node(key_type_node);
      const value_type_str = stringify_type_node(value_type_node);

      const internal_dependencies = new Set<string>();

      const key_schema_result = strategy.get_or_generate_view_and_schema_for_type(key_type_str);

      if (key_schema_result.class_name.startsWith('___intr_View_')) {
         internal_dependencies.add(key_schema_result.class_name);
      }

      const value_schema_result = strategy.get_or_generate_view_and_schema_for_type(value_type_str);

      if (value_schema_result.class_name.startsWith('___intr_View_')) {
         internal_dependencies.add(value_schema_result.class_name);
      }

      const schema_layout: SchemaLayout = {
         class_name: class_name,
         total_size: POINTER_SIZE,
         alignment: POINTER_SIZE,
         has_dynamic_data: true,
         properties: [
            {
               property_key: 'keys',
               order: 0,
               type: key_type_str,
               offset: 0,
               size: 0,
               alignment: 0,
               binary_info: {
                  size: POINTER_SIZE,
                  alignment: POINTER_SIZE,
                  is_dynamic: true,
                  has_dynamic_data: true,
                  key_type: key_type_str,
                  key_schema: key_schema_result.schema
               }
            },
            {
               property_key: 'values',
               order: 1,
               type: value_type_str,
               offset: 0,
               size: 0,
               alignment: 0,
               binary_info: {
                  size: POINTER_SIZE,
                  alignment: POINTER_SIZE,
                  is_dynamic: true,
                  has_dynamic_data: true,
                  element_type: value_type_str,
                  element_schema: value_schema_result.schema
               }
            }
         ]
      };

      if (key_type_str === 'str') {
         const result = this.#generate_string_key_standalone_class(strategy, class_name, value_type_node, value_type_str, schema_layout);
         result.internal_dependencies = internal_dependencies;

         return result;
      }

      if (FIXED_PRIMITIVE_TYPES.has(key_type_str)) {
         const result = this.#generate_primitive_key_standalone_class(strategy, class_name, key_type_str, value_type_node, value_type_str, schema_layout);
         result.internal_dependencies = internal_dependencies;

         return result;
      }

      throw new Error(`maps with key type '${key_type_str}' are not yet supported`);
   }

   #generate_string_key_standalone_class(
      strategy: ICodegenStrategy,
      class_name: string,
      value_type_node: TypeNode,
      value_type_str: string,
      schema_layout: SchemaLayout
   ): {
      code: string;
      imports: Set<string>;
      schema: SchemaLayout;
      internal_dependencies: Set<string>;
   } {
      const imports = new Set<string>([
         'SchemaLayout',
         'POINTER_SIZE',
         'IViewConstructor',
         'Pointer',
         'TlsfAllocator'
      ]);

      const internal_dependencies = new Set<string>();

      const schema_code = generate_schema_layout_code(strategy, schema_layout);

      if (value_type_str === 'str') {
         imports.add('DynamicHashMapStringString');

         const code = `\
export class ${class_name} extends DynamicHashMapStringString  {
   static readonly __schema: SchemaLayout = ${schema_code};
}\
`;

         return {
            code,
            imports,
            schema: schema_layout,
            internal_dependencies
         };
      }

      if (FIXED_PRIMITIVE_TYPES.has(value_type_str)) {
         imports.add('DynamicHashMapStringPrimitive');
         imports.add('DynamicString');
         imports.add('PrimitiveView');

         const details = FIXED_PRIMITIVE_TYPE_DETAILS.get(value_type_str)!;
         const ts_type = details.ts_type;
         const view_helper_info = strategy.get_or_generate_view_and_schema_for_type(value_type_str);
         const view_helper_name = view_helper_info.class_name;

         if (view_helper_name.startsWith('___intr_View_')) {
            internal_dependencies.add(view_helper_name);
         }

         const code = `\
export class ${class_name} extends DynamicHashMapStringPrimitive<${ts_type}, ${view_helper_name}> {

   static readonly __schema: SchemaLayout = ${schema_code};

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: number,
      allocator: TlsfAllocator,
      //
      owner_constructor?: IViewConstructor<IView>,
      owner_allocation_ptr?: Pointer
   ) {
      super(
         buffer,
         byte_offset,
         allocator,
         //
         ${view_helper_name},
         //
         owner_constructor,
         owner_allocation_ptr
      );
   }

   get $value_size(): number {
      return ${details.size};
   }

   get $value_alignment(): number {
      return ${details.alignment};
   }

   $read_value(b: DataView, o: Pointer): ${ts_type} {
      return new ${view_helper_name}(b.buffer, o).value;
   }

   $write_value(b: DataView, o: Pointer, v: ${ts_type}) {
      new ${view_helper_name}(b.buffer, o).value = v;
   }
}\
`;
         return {
            code,
            imports,
            schema: schema_layout,
            internal_dependencies
         };
      }

      const result = strategy.get_or_generate_view_and_schema_for_type(value_type_str);
      const value_view_class_name = result.class_name;

      if (value_view_class_name.startsWith('___intr_View_')) {
         internal_dependencies.add(value_view_class_name);
      }

      imports.add('DynamicHashMapStringOf');
      imports.add(value_type_str);


      const code = `\
export class ${class_name} extends DynamicHashMapStringOf<${value_view_class_name}> {

   static readonly __schema: SchemaLayout = ${schema_code};

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator,
      //
      owner_constructor?: IViewConstructor<IView>,
      owner_allocation_ptr?: Pointer
   ) {
      super(
         buffer,
         byte_offset,
         allocator,
         //
         ${value_view_class_name},
         //
         owner_constructor,
         owner_allocation_ptr
      );
   }
}`;
      return {
         code,
         imports,
         schema: schema_layout,
         internal_dependencies
      };
   }

   #generate_primitive_key_standalone_class(
      strategy: ICodegenStrategy,
      class_name: string,
      key_type_str: string,
      value_type_node: TypeNode,
      value_type_str: string,
      schema_layout: SchemaLayout
   ): {
      code: string;
      imports: Set<string>;
      schema: SchemaLayout;
      internal_dependencies: Set<string>;
   } {
      const imports = new Set<string>([
         'SchemaLayout',
         'POINTER_SIZE',
         'IViewConstructor',
         'Pointer',
         'TlsfAllocator'
      ]);

      const internal_dependencies = new Set<string>();

      imports.add('PrimitiveView');

      const key_details = FIXED_PRIMITIVE_TYPE_DETAILS.get(key_type_str)!;
      const key_ts_type = key_details.ts_type;
      const key_view_info = strategy.get_or_generate_view_and_schema_for_type(key_type_str);
      const key_view_name = key_view_info.class_name;

      if (key_view_name.startsWith('___intr_View_')) {
         internal_dependencies.add(key_view_name);
      }

      const schema_code = generate_schema_layout_code(strategy, schema_layout);

      const hash_logic = key_ts_type === 'bigint'
         ? `\
      const upper = Number((key >> 32n) & 0xFFFFFFFFn);
      const lower = Number(key & 0xFFFFFFFFn);
      
      return (upper ^ lower) | 0;\
`
         : `\
      return Number(key) | 0;\
`;

      if (value_type_str === 'str') {
         imports.add('DynamicHashMapPrimitiveString');
         imports.add('DynamicString');

         const code = `\
export class ${class_name} extends DynamicHashMapPrimitiveString<${key_ts_type}, ${key_view_name}> {

   static readonly __schema: SchemaLayout = ${schema_code};

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: number,
      allocator: TlsfAllocator,
      //
      owner_constructor?: IViewConstructor<IView>,
      owner_allocation_ptr?: Pointer
   ) {
      super(
         buffer,
         byte_offset,
         allocator,
         //
         ${key_view_name},
         DynamicString,
         //
         owner_constructor,
         owner_allocation_ptr
      );
   }

   get $key_size(): number {
      return ${key_details.size};
   }

   get $key_alignment(): number {
      return ${key_details.alignment};
   }

   $read_key(b: DataView, o: Pointer): ${key_ts_type} {
      return new ${key_view_name}(b.buffer, o).value;
   }

   $write_key(b: DataView, o: Pointer, v: ${key_ts_type}) {
      new ${key_view_name}(b.buffer, o).value = v;
   }

   $hash_key(key: ${key_ts_type}): number {
${hash_logic}
   }
}`;
         return {
            code,
            imports,
            schema: schema_layout,
            internal_dependencies
         };
      }

      if (FIXED_PRIMITIVE_TYPES.has(value_type_str)) {
         imports.add('DynamicHashMapPrimitivePrimitive');

         const value_details = FIXED_PRIMITIVE_TYPE_DETAILS.get(value_type_str)!;
         const value_ts_type = value_details.ts_type;
         const value_view_info = strategy.get_or_generate_view_and_schema_for_type(value_type_str);
         const value_view_name = value_view_info.class_name;

         if (value_view_name.startsWith('___intr_View_')) {
            internal_dependencies.add(value_view_name);
         }

         const code = `\
export class ${class_name} extends DynamicHashMapPrimitivePrimitive<${key_ts_type}, ${key_view_name}, ${value_ts_type}, ${value_view_name}> {

   static readonly __schema: SchemaLayout = ${schema_code};

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: number,
      allocator: TlsfAllocator,
      //
      owner_constructor?: IViewConstructor<IView>,
      owner_allocation_ptr?: Pointer
   ) {
      super(
         buffer,
         byte_offset,
         allocator,
         //
         ${key_view_name},
         ${value_view_name},
         //
         owner_constructor,
         owner_allocation_ptr
      );
   }

   get $key_size(): number {
      return ${key_details.size};
   }

   get $key_alignment(): number {
      return ${key_details.alignment};
   }

   $read_key(b: DataView, o: Pointer): ${key_ts_type} {
      return new ${key_view_name}(b.buffer, o).value;
   }

   $write_key(b: DataView, o: Pointer, v: ${key_ts_type}) {
      new ${key_view_name}(b.buffer, o).value = v;
   }

   $hash_key(key: ${key_ts_type}): number {
${hash_logic}
   }

   get $value_size(): number {
      return ${value_details.size};
   }

   get $value_alignment(): number {
      return ${value_details.alignment};
   }

   $read_value(b: DataView, o: Pointer): ${value_ts_type} {
      return new ${value_view_name}(b.buffer, o).value;
   }

   $write_value(b: DataView, o: Pointer, v: ${value_ts_type}) {
      new ${value_view_name}(b.buffer, o).value = v;
   }
}`;
         return {
            code,
            imports,
            schema: schema_layout,
            internal_dependencies
         };
      }

      imports.add('DynamicHashMapPrimitiveOf');
      const result = strategy.get_or_generate_view_and_schema_for_type(value_type_str);
      const value_view_class_name = result.class_name;

      if (value_view_class_name.startsWith('___intr_View_')) {
         internal_dependencies.add(value_view_class_name);
      }

      imports.add(value_type_str);

      const code = `\
export class ${class_name} extends DynamicHashMapPrimitiveOf<${key_ts_type}, ${key_view_name}, ${value_view_class_name}> {

   static readonly __schema: SchemaLayout = ${schema_code};

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator,
      //
      owner_constructor?: IViewConstructor<IView>,
      owner_allocation_ptr?: Pointer
   ) {
      super(
         buffer,
         byte_offset,
         allocator,
         //
         ${key_view_name},
         ${value_view_class_name},
         //
         owner_constructor,
         owner_allocation_ptr
      );
   }

   get $key_size(): number {
      return ${key_details.size};
   }

   get $key_alignment(): number {
      return ${key_details.alignment};
   }

   $read_key(b: DataView, o: Pointer): ${key_ts_type} {
      return new ${key_view_name}(b.buffer, o).value;
   }

   $write_key(b: DataView, o: Pointer, v: ${key_ts_type}) {
      new ${key_view_name}(b.buffer, o).value = v;
   }

   $hash_key(key: ${key_ts_type}): number {
${hash_logic}
   }
}`;
      return {
         code,
         imports,
         schema: schema_layout,
         internal_dependencies
      };
   }

   generate_getter(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string {
      const prop_key_str = String(property_layout.property_key);
      const private_prop_name = `#${prop_key_str}_view`;
      const is_optional = property_layout.binary_info.is_optional;

      const view_type_info = strategy.get_or_generate_view_and_schema_for_type(property_layout.type);
      const view_type = view_type_info.class_name;

      const constructor_call = `\
new ${view_type}(
            this.__buffer,
            this.__byte_offset + prop_schema.offset,
            this.__allocator!,
            ${class_name},
            this.__byte_offset
         )\
`;

      const return_type = is_optional ? `${view_type} | undefined` : view_type;
      const comment_block = property_layout.description
         ? `\
   /**
    * ${property_layout.description.replace(/\n/g, '\n    * ')}
    */\
`
         : '';

      const optional_check = is_optional
         ? `\n\n\
      if (this.${private_prop_name}.$control_block_ptr === GLOBAL_NULL_POINTER) {
         return;
      }\n\n\
`
         : '';

      return `\
${comment_block}
   get ${prop_key_str}(): ${return_type} {
      if (this.${private_prop_name} == null) {
         const prop_schema = ${class_name}.__schema.properties[${property_layout.order}]!;

         this.${private_prop_name} = ${constructor_call};
      }
${optional_check}
      return this.${private_prop_name};
   }\
`;
   }

   generate_setter(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string {
      const setter_access = property_layout.read_only ? 'private set' : 'set';
      const key_type = property_layout.binary_info.key_type!;
      const value_type = property_layout.binary_info.element_type!;
      const prop_key_str = String(property_layout.property_key);
      const is_optional = property_layout.binary_info.is_optional;

      const view_type_info = strategy.get_or_generate_view_and_schema_for_type(property_layout.type);
      const view_type = view_type_info.class_name;

      const key_ts_type = FIXED_PRIMITIVE_TYPES.has(key_type) ? FIXED_PRIMITIVE_TYPE_DETAILS.get(key_type)!.ts_type : 'string';
      const value_ts_type = FIXED_PRIMITIVE_TYPES.has(value_type) ? FIXED_PRIMITIVE_TYPE_DETAILS.get(value_type)!.ts_type : strategy.get_or_generate_view_and_schema_for_type(value_type).class_name;

      const setter_param = is_optional
         ? `value?: Map<${key_ts_type}, ${value_ts_type}> | ${view_type}`
         : `value: Map<${key_ts_type}, ${value_ts_type}> | ${view_type}`;

      const optional_logic = is_optional
         ? `\n\n\
      if (
         dest == null
         && value == null
      ) {
         return;
      }

      if (value == null) {
         dest!.free();

         return;
      }\n\n\
`
         : '';

      return `\
   ${setter_access} ${prop_key_str}(${setter_param}) {
      const dest = this.${prop_key_str};
${optional_logic}
      dest!.$copy_from(value);
   }\
`;
   }

   generate_free_statement(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);
      const private_prop_name = `#${prop_key_str}_view`;

      return `\
      this.${private_prop_name}?.free?.();
`;
   }

   generate_pointer_accessors(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string {
      const prop_key_str = String(property_layout.property_key);
      const private_prop_name = `#${prop_key_str}_view`;
      const ptr_prop_key = `${prop_key_str}_ptr`;

      return `\
   /** @internal */
   get ${ptr_prop_key}(): Pointer {
      this.${prop_key_str}; // ensures the view is initialized

      return this.${private_prop_name}!.$control_block_ptr;
   }

   /** @internal */
   set ${ptr_prop_key}(ptr: Pointer) {
      this.${prop_key_str}; // ensures the view is initialized

      this.${private_prop_name}!.$control_block_ptr = ptr;
   }\
`;
   }

   generate_hash_statement(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined {
      // TODO: IHashable?
      return;
   }

   generate_equals_statement(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined {
      // TODO: implement deep equal under a build flag 
      return;
   }

   generate_union_getter_case(
      strategy: ICodegenStrategy,
      variant: UnionVariantMetadata,
      property_layout: PropertyLayout,
      class_name: string
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);
      const private_prop_name = `#${prop_key_str}_view_${sanitize_type_for_name(variant.type_string)}`;

      const view_type_info = strategy.get_or_generate_view_and_schema_for_type(variant.type_string);
      const constructor_call = `\
new ${view_type_info.class_name}(
                     this.__buffer,
                     data_offset,
                     this.__allocator!,
                     ${class_name},
                     this.__byte_offset
                  )\
`;

      return `\
            case ${variant.tag}: {
               if (this.${private_prop_name} == null) {
                  this.${private_prop_name} = ${constructor_call};
               }

               return this.${private_prop_name};
            }\
`;
   }

   generate_union_setter_case(
      strategy: ICodegenStrategy,
      variant: UnionVariantMetadata,
      property_layout: PropertyLayout,
      class_name: string
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);
      const view_type_info = strategy.get_or_generate_view_and_schema_for_type(variant.type_string);
      const view_class_name = view_type_info.class_name;

      return `\
      if (
         value instanceof ${view_class_name}
         || value instanceof Map
      ) {
         new_tag = ${variant.tag};

         if (current_tag !== new_tag) {
            free_and_clear_current();

            this.__view.setUint8(tag_offset, new_tag);
         }

         // might type error
         this.${prop_key_str}.$copy_from(value);
      }\
`;
   }

   generate_union_free_case(
      strategy: ICodegenStrategy,
      variant: UnionVariantMetadata,
      property_layout: PropertyLayout
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);

      return `\
            case ${variant.tag}: {
               this.${prop_key_str}?.free?.();
               
               break;
            }\
`;
   }
}