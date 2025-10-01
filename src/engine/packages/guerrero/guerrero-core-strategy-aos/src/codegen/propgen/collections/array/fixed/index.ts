/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/codegen/propgen/collections/array/fixed/index.ts
 */

import type { PropertyLayout, SchemaLayout, UnionVariantMetadata } from '@eldritch-engine/type-utils/guerrero/index';
import type { ICodegenStrategy, IPropertyCodegen } from '@eldritch-engine/type-utils/guerrero/codegen';
import type { TypeNode, FixedArrayTypeNode } from '@eldritch-engine/type-utils/guerrero/parser';

import { TypeParser, stringify_type_node } from '@eldritch-engine/guerrero-core/layout/parser/parser';

import { generate_schema_layout_code, sanitize_type_for_name } from '@eldritch-engine/guerrero-core/utils/schema';
import { FIXED_PRIMITIVE_TYPE_DETAILS, FIXED_PRIMITIVE_TYPES } from '@eldritch-engine/guerrero-core/layout/constants';

export class FixedArrayPropgen implements IPropertyCodegen {

   can_handle(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): boolean {
      const pl_binary_info = property_layout.binary_info;

      return (
         pl_binary_info.element_count != null
         && pl_binary_info.element_count > 0
         && pl_binary_info.element_type != null
         && (
            FIXED_PRIMITIVE_TYPES.has(pl_binary_info.element_type as string)
            || pl_binary_info.is_nested_struct
            || pl_binary_info.element_type === 'str'
            || new TypeParser(property_layout.type).parse().kind === 'fixed_array'
         )
         && !pl_binary_info.is_dynamic
      );
   }

   get_required_imports(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): Set<string> {
      const element_type_str = property_layout.binary_info.element_type;

      if (!element_type_str) {
         return new Set();
      }

      const element_type_node = new TypeParser(element_type_str).parse();
      const imports = new Set<string>();

      imports.add('POINTER_SIZE');
      imports.add('FixedArray');
      imports.add('IViewConstructor');
      imports.add('TlsfAllocator');
      imports.add('IGuerreroFixedArray');
      imports.add('IHashable');

      if (element_type_str === 'str') {
         imports.add('FixedArrayString');
         imports.add('DynamicString');
         imports.add('hash_djb2');
      } else if (FIXED_PRIMITIVE_TYPES.has(element_type_str)) {
         imports.add('FixedArrayPrimitive');
         imports.add('PrimitiveView');
      } else {
         imports.add('FixedArrayOf');

         if (element_type_node.kind === 'identifier') {
            imports.add(element_type_node.name);
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
      return type_node.kind === 'fixed_array';
   }

   #generate_hash_method_for_standalone(
      element_type_str: string
   ): string {
      let element_hash_logic: string;

      if (element_type_str === 'str') {
         element_hash_logic = 'hash_djb2(item ?? "")';
      } else if (FIXED_PRIMITIVE_TYPES.has(element_type_str)) {
         element_hash_logic = 'Number(item ?? 0)';
      } else {
         element_hash_logic = 'item?.$hash()';
      }

      return `\
   $hash(): number {
      let hash = 17;

      for (const item of this) {
         hash = (hash * 31 + ${element_hash_logic}) | 0;
      }

      return hash;
   }\
`;
   }

   #generate_equals_method_for_standalone(
      element_type_str: string
   ): string {
      let element_equals_logic: string;

      if (
         FIXED_PRIMITIVE_TYPES.has(element_type_str)
         || element_type_str === 'str'
      ) {
         element_equals_logic = `this[i] !== other[i]`;
      } else {
         element_equals_logic = `!this[i]?.$equals?.(other[i]!)`;
      }

      return `\
   $equals(other: this): boolean {
      if (this.length !== other.length) {
         return false;
      }

      for (let i = 0; i < this.length; i++) {
         if (${element_equals_logic}) {
            return false;
         }
      }

      return true;
   }\
`;
   }

   #generate_indexed_accessors(
      count: number,
      ts_type: string
   ): string {
      let accessors = '';

      for (let i = 0; i < count; i++) {
         accessors += `
   get [${i}](): ${ts_type} | undefined {
      return this.get(${i});
   }

   set [${i}](value: ${ts_type}) {
      this.set(${i}, value);
   }
`;
      }
      return accessors;
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
      if (type_node.kind !== 'fixed_array') {
         throw new Error('FixedArrayPropgen can only handle FixedArrayTypeNode');
      }

      const array_node = type_node as FixedArrayTypeNode;
      const element_type_node = array_node.element_type;
      const element_type_str = stringify_type_node(element_type_node);
      const count = array_node.count;

      const imports = new Set<string>([
         'SchemaLayout',
         'POINTER_SIZE',
         'IViewConstructor',
         'Pointer',
         'TlsfAllocator',
         'IGuerreroFixedArray',
         'IHashable'
      ]);

      const internal_dependencies = new Set<string>();

      const element_info = strategy.resolver.resolve(element_type_str, false).binary_type_info;
      const array_schema_layout: SchemaLayout = {
         class_name: class_name,
         total_size: element_info.size * count,
         alignment: element_info.alignment,
         has_dynamic_data: element_info.has_dynamic_data ?? false,
         properties: []
      };

      const schema_code = generate_schema_layout_code(strategy, array_schema_layout);

      const hash_method = this.#generate_hash_method_for_standalone(element_type_str);
      const equals_method = this.#generate_equals_method_for_standalone(element_type_str);

      if (element_type_str === 'str') {
         imports.add('FixedArrayString');
         imports.add('hash_djb2');

         const accessors = this.#generate_indexed_accessors(count, 'string');

         const code = `\
export class ${class_name} extends FixedArrayString<${count}> implements IHashable  {

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
         ${count},
         //
         owner_constructor,
         owner_allocation_ptr
      );
   }

${accessors}

${hash_method}

${equals_method}
}
`;
         return {
            code,
            imports,
            schema: array_schema_layout,
            internal_dependencies
         };
      } else if (FIXED_PRIMITIVE_TYPES.has(element_type_str)) {
         imports.add('FixedArrayPrimitive');
         imports.add('FixedArray');
         imports.add('PrimitiveView');

         const details = FIXED_PRIMITIVE_TYPE_DETAILS.get(element_type_str)!;
         const ts_type = details.ts_type;

         const primitive_view_info = strategy.get_or_generate_view_and_schema_for_type(element_type_str);
         const primitive_view_class_name = primitive_view_info.class_name;

         internal_dependencies.add(primitive_view_class_name);

         const accessors = this.#generate_indexed_accessors(count, ts_type);

         const code = `\
export class ${class_name} extends FixedArrayPrimitive<${primitive_view_class_name}, ${ts_type}, ${count}> implements IHashable {

   static readonly __schema: SchemaLayout = ${schema_code};

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: number,
      allocator?: TlsfAllocator,
      //
      owner_constructor?: IViewConstructor<IView>,
      owner_allocation_ptr?: Pointer
   ) {
      super(
         buffer,
         byte_offset,
         allocator,
         //
         ${primitive_view_class_name},
         ${count},
         //
         owner_constructor,
         owner_allocation_ptr
      );
   }

   //

   get(index: number): ${ts_type} | undefined {
      return this.$get_element_view(index)?.value;
   }

   set(index: number, value: ${ts_type}): boolean {
      const view = this.$get_element_view(index);

      if (view) {
         view.value = value;
         
         return true;
      }

      return false;
   }

${accessors}

${hash_method}

${equals_method}
}
`;
         return {
            code,
            imports,
            schema: array_schema_layout,
            internal_dependencies
         };
      } else {
         imports.add('FixedArrayOf');

         const result = strategy.get_or_generate_view_and_schema_for_type(element_type_str);
         const element_view_class_name = result.class_name;

         if (element_view_class_name.startsWith('___intr_View_')) {
            internal_dependencies.add(element_view_class_name);
         }

         imports.add(element_type_str);

         const accessors = this.#generate_indexed_accessors(count, element_view_class_name);

         const code = `\
export class ${class_name} extends FixedArrayOf<${element_view_class_name}, ${count}> implements IHashable {

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
         ${element_view_class_name},
         ${count},
         //
         owner_constructor,
         owner_allocation_ptr
      );
   }
   
${accessors}

${hash_method}

${equals_method}
}
`;
         return {
            code,
            imports,
            schema: array_schema_layout,
            internal_dependencies
         };
      }
   }

   generate_getter(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string {
      const prop_key_str = String(property_layout.property_key);
      const private_prop_name = `#${prop_key_str}_view`;

      const view_type_info = strategy.get_or_generate_view_and_schema_for_type(property_layout.type);
      const view_type = view_type_info.class_name;

      const constructor_call = `\
new ${view_type}(
            this.__buffer,
            this.__byte_offset + prop_schema.offset,
            this.__allocator,
            ${class_name},
            this.__byte_offset
         )\
`;

      const return_type_name = view_type;

      const comment_block = property_layout.description
         ? `\
   /**
    * ${property_layout.description.replace(/\n/g, '\n    * ')}
    */\
`
         : '';

      return `\
${comment_block}
   get ${prop_key_str}(): ${return_type_name} {
      if (this.${private_prop_name} == null) {
         const prop_schema = ${class_name}.__schema.properties[${property_layout.order}]!;

         this.${private_prop_name} = ${constructor_call};
      }

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
      const prop_key_str = String(property_layout.property_key);
      const element_type_str = property_layout.binary_info.element_type!;
      const count = property_layout.binary_info.element_count!;

      const view_type_info = strategy.get_or_generate_view_and_schema_for_type(property_layout.type);
      const view_class_name_for_type_hint = view_type_info.class_name;

      let value_ts_type: string;
      if (FIXED_PRIMITIVE_TYPES.has(element_type_str)) {
         value_ts_type = FIXED_PRIMITIVE_TYPE_DETAILS.get(element_type_str)!.ts_type;
      } else if (element_type_str === 'str') {
         value_ts_type = 'string';
      } else {
         const element_view_info = strategy.get_or_generate_view_and_schema_for_type(element_type_str);

         value_ts_type = element_view_info.class_name;
      }

      const tuple_type = `[${new Array(count).fill(value_ts_type).join(', ')}]`;
      const setter_param = `value: ${tuple_type} | ${view_class_name_for_type_hint} | Iterable<${value_ts_type}>`;

      return `\
   ${setter_access} ${prop_key_str}(${setter_param}) {
      this.${prop_key_str}.$copy_from(value);
   }`;
   }

   generate_free_statement(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined {
      const element_type = property_layout.binary_info.element_type;

      const needs_element_free = (
         element_type === 'str'
         || property_layout.binary_info.is_nested_struct
         || property_layout.binary_info.has_dynamic_data
      );

      if (!needs_element_free) {
         return;
      }

      const prop_key_str = String(property_layout.property_key);

      return `\
      this.${prop_key_str}.free?.();\
`;
   }

   generate_hash_statement(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);
      const element_type = property_layout.binary_info.element_type as string;

      let element_hash_logic: string;

      if (element_type === 'str') {
         element_hash_logic = 'hash_djb2(item ?? "")';
      } else if (FIXED_PRIMITIVE_TYPES.has(element_type)) {
         element_hash_logic = 'Number(item ?? 0)';
      } else { // nested struct or collection
         element_hash_logic = 'item?.$hash()';
      }

      return `\
      for (const item of this.${prop_key_str}) {
         hash = (hash * 31 + ${element_hash_logic}) | 0;
      }\
`;
   }

   generate_equals_statement(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);
      const element_type = property_layout.binary_info.element_type as string;

      let element_equals_logic: string;

      if (
         FIXED_PRIMITIVE_TYPES.has(element_type)
         || element_type === 'str'
      ) {
         element_equals_logic = `this.${prop_key_str}[i] !== other.${prop_key_str}[i]`;
      } else { // nested struct or collection
         element_equals_logic = `!this.${prop_key_str}[i]?.$equals?.(other.${prop_key_str}[i]!)`;
      }

      return `\
      for (let i = 0; i < this.${prop_key_str}.length; i++) {
         if (${element_equals_logic}) {
            return false;
         }
      }\
`;
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
      const constructor_call = `new ${view_type_info.class_name}(this.__buffer, data_offset, this.__allocator, ${class_name}, this.__byte_offset)`;

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
      if (value instanceof ${view_class_name}) {
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
      if (!variant.binary_info.has_dynamic_data) {
         return `case ${variant.tag}: break;`;
      }

      const prop_key_str = String(property_layout.property_key);

      return `\
            case ${variant.tag}: {
               this.${prop_key_str}?.free?.();
               
               break;
            }\
`;
   }
}