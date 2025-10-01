/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/codegen/propgen/collections/array/dynamic/index.ts
 */

import type { PropertyLayout, SchemaLayout, UnionVariantMetadata } from '@eldritch-engine/type-utils/guerrero/index';
import type { ICodegenStrategy, IPropertyCodegen } from '@eldritch-engine/type-utils/guerrero/codegen';
import type { TypeNode, DynamicArrayTypeNode } from '@eldritch-engine/type-utils/guerrero/parser';

import { TypeParser, stringify_type_node } from '@eldritch-engine/guerrero-core/layout/parser/parser';
import { generate_schema_layout_code, sanitize_type_for_name } from '@eldritch-engine/guerrero-core/utils/schema';
import { FIXED_PRIMITIVE_TYPE_DETAILS, FIXED_PRIMITIVE_TYPES } from '@eldritch-engine/guerrero-core/layout/constants';
import { POINTER_SIZE } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

export class DynamicArrayPropgen implements IPropertyCodegen {

   can_handle(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): boolean {
      return (property_layout.binary_info.is_dynamic ?? false)
         && new TypeParser(property_layout.type).parse().kind === 'dynamic_array';
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
      imports.add('IGuerreroArray');
      imports.add('IViewConstructor');
      imports.add('TlsfAllocator');
      imports.add('DynamicArray');

      if (element_type_str === 'str') {
         imports.add('DynamicArrayString');
      } else if (FIXED_PRIMITIVE_TYPES.has(element_type_str)) {
         imports.add('DynamicArrayPrimitive');
         imports.add('PrimitiveView');
      } else {
         imports.add('DynamicArrayOf');

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
      return type_node.kind === 'dynamic_array';
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
      const array_node = type_node as DynamicArrayTypeNode;
      const element_type_node = array_node.element_type;
      const element_type_str = stringify_type_node(element_type_node);

      const imports = new Set<string>([
         'SchemaLayout',
         'POINTER_SIZE',
         'IViewConstructor',
         'Pointer',
         'TlsfAllocator'
      ]);

      const internal_dependencies = new Set<string>();

      const element_schema = strategy.get_or_generate_view_and_schema_for_type(element_type_str).schema;

      if (element_schema.class_name?.startsWith('___intr_View_')) {
         internal_dependencies.add(element_schema.class_name);
      }

      const schema_layout: SchemaLayout = {
         class_name: class_name,
         total_size: POINTER_SIZE,
         alignment: POINTER_SIZE,
         has_dynamic_data: true,
         properties: [
            {
               property_key: 'elements',
               order: 0,
               type: element_type_str,
               offset: 0,
               size: 0,      // not applicable for standalone/dynamic
               alignment: 0, // not applicable
               binary_info: {
                  size: POINTER_SIZE,
                  alignment: POINTER_SIZE,
                  element_type: element_type_str,
                  element_schema: element_schema,
                  is_dynamic: true,
                  has_dynamic_data: true
               }
            }
         ]
      };

      const schema_code = generate_schema_layout_code(strategy, schema_layout);

      if (element_type_str === 'str') {
         imports.add('DynamicArrayString');
         imports.add('IGuerreroArray');

         const code = `\
export class ${class_name} extends DynamicArrayString implements IGuerreroArray<string> {
   static readonly __schema: SchemaLayout = ${schema_code};
}

export interface ${class_name} extends IGuerreroArray<string> {
   [index: number]: string | undefined;
}
`;
         return {
            code,
            imports,
            schema: schema_layout,
            internal_dependencies
         };
      }

      if (FIXED_PRIMITIVE_TYPES.has(element_type_str)) {
         imports.add('DynamicArrayPrimitive');
         imports.add('DynamicArray');
         imports.add('IGuerreroArray');
         imports.add('PrimitiveView');

         const details = FIXED_PRIMITIVE_TYPE_DETAILS.get(element_type_str)!;
         const primitive_view_info = strategy.get_or_generate_view_and_schema_for_type(element_type_str);
         const primitive_view_class_name = primitive_view_info.class_name;
         internal_dependencies.add(primitive_view_class_name);
         const ts_type = details.ts_type;

         const code = `\
export class ${class_name} extends DynamicArrayPrimitive<${primitive_view_class_name}, ${ts_type}> implements IGuerreroArray<${ts_type}> {

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
         ${primitive_view_class_name},
         //
         owner_constructor,
         owner_allocation_ptr
      );

      // might type error
      return new Proxy(this, DynamicArray.$create_proxy_handler<${primitive_view_class_name}, ${ts_type}>()) as ${class_name};
   }

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

   push(...values: ${ts_type}[]): number {
      for (const value of values) {
         this.$push_new_slot().value = value;
      }

      return this.length;
   }
}

export interface ${class_name} extends IGuerreroArray<${ts_type}> {
   [index: number]: ${ts_type} | undefined;
}
`;
         return {
            code,
            imports,
            schema: schema_layout,
            internal_dependencies
         };
      }

      imports.add('DynamicArrayOf');

      const result = strategy.get_or_generate_view_and_schema_for_type(element_type_str);
      const element_view_class_name = result.class_name;

      if (element_view_class_name.startsWith('___intr_View_')) {
         internal_dependencies.add(element_view_class_name);
      }

      imports.add(element_type_str);

      const code = `\
export class ${class_name} extends DynamicArrayOf<${element_view_class_name}> implements IGuerreroArray<${element_view_class_name}> {

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
         //
         owner_constructor,
         owner_allocation_ptr
      );
   }
}

export interface ${class_name} {
   [index: number]: ${element_view_class_name} | undefined;
}
`;
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
    */
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
      const prop_key_str = String(property_layout.property_key);
      const element_type_str = property_layout.binary_info.element_type!;

      const is_optional = property_layout.binary_info.is_optional;

      const view_type_info = strategy.get_or_generate_view_and_schema_for_type(property_layout.type);
      const view_type = view_type_info.class_name;

      let value_type: string;

      if (element_type_str === 'str') {
         value_type = 'string';
      } else if (FIXED_PRIMITIVE_TYPES.has(element_type_str)) {
         value_type = FIXED_PRIMITIVE_TYPE_DETAILS.get(element_type_str)!.ts_type;
      } else {
         const element_view_info = strategy.get_or_generate_view_and_schema_for_type(element_type_str);
         value_type = element_view_info.class_name;
      }

      const setter_param = is_optional
         ? `value?: ${view_type} | Iterable<${value_type}>`
         : `value: ${view_type} | Iterable<${value_type}>`;

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
      } else {
         dest!.$copy_from(value);
      }\n\n\
`
         : `\n\n\
      this.${prop_key_str}.$copy_from(value);\n\n\
`;

      return `\
   ${setter_access} ${prop_key_str}(${setter_param}) {
      const dest = this.${prop_key_str};
${optional_logic}
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
      this.${private_prop_name}?.free?.();\
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
         || Array.isArray(value)
      ) {
         new_tag = ${variant.tag};

         if (current_tag !== new_tag) {
            free_and_clear_current();

            this.__view.setUint8(tag_offset, new_tag);
         }

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