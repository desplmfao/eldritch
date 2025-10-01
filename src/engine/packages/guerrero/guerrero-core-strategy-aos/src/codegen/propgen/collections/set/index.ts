/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/codegen/propgen/collections/set/index.ts
 */

import type { PropertyLayout, SchemaLayout, UnionVariantMetadata } from '@eldritch-engine/type-utils/guerrero/index';
import type { ICodegenStrategy, IPropertyCodegen } from '@eldritch-engine/type-utils/guerrero/codegen';
import type { TypeNode, SetTypeNode, FixedArrayTypeNode } from '@eldritch-engine/type-utils/guerrero/parser';

import { TypeParser, stringify_type_node } from '@eldritch-engine/guerrero-core/layout/parser/parser';
import { generate_schema_layout_code } from '@eldritch-engine/guerrero-core/utils/schema';
import { FIXED_PRIMITIVE_TYPE_DETAILS, FIXED_PRIMITIVE_TYPES } from '@eldritch-engine/guerrero-core/layout/constants';
import { POINTER_SIZE } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

export class DynamicSetPropgen implements IPropertyCodegen {

   can_handle(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): boolean {
      return (property_layout.binary_info.is_dynamic ?? false)
         && new TypeParser(property_layout.type).parse().kind === 'set';
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
      imports.add('TlsfAllocator');
      imports.add('IViewConstructor');
      imports.add('DynamicSet');
      imports.add('GLOBAL_NULL_POINTER');

      if (element_type_str === 'str') {
         imports.add('DynamicSetString');
      } else if (FIXED_PRIMITIVE_TYPES.has(element_type_str)) {
         imports.add('DynamicSetPrimitive');
         imports.add('PrimitiveView');
      } else {
         imports.add('DynamicSetOf');

         if (element_type_node.kind === 'identifier') {
            imports.add(element_type_str);
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
   ${private_prop_name}: ${view_type_info.class_name};
`;
   }

   can_handle_as_standalone(
      type_node: TypeNode
   ): boolean {
      return type_node.kind === 'set';
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
      const set_node = type_node as SetTypeNode;
      const element_type_node = set_node.element_type;
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
         imports.add('DynamicSetString');

         const code = `\
export class ${class_name} extends DynamicSetString {
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

      if (FIXED_PRIMITIVE_TYPES.has(element_type_str)) {
         imports.add('DynamicSetPrimitive');
         imports.add('PrimitiveView');

         const details = FIXED_PRIMITIVE_TYPE_DETAILS.get(element_type_str)!;
         const ts_type = details.ts_type;
         const view_helper_info = strategy.get_or_generate_view_and_schema_for_type(element_type_str);
         const view_helper_name = view_helper_info.class_name;

         internal_dependencies.add(view_helper_name);

         const code = `\
export class ${class_name} extends DynamicSetPrimitive<${ts_type}, ${view_helper_name}> {

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

   get $key_size(): number {
      return ${details.size};
   }

   get $key_alignment(): number {
      return ${details.alignment};
   }

   $read_key(b: DataView, o: Pointer): ${ts_type} {
      return new ${view_helper_name}(b.buffer, o).value;
   }

   $write_key(b: DataView, o: Pointer, v: ${ts_type}) {
      new ${view_helper_name}(b.buffer, o).value = v;
   }

   $hash_key(key: ${ts_type}): number {
      return Number(key) | 0;
   }

   $are_keys_equal(key1: ${ts_type}, key2_view: ${view_helper_name}): boolean {
      return key1 === key2_view.value;
   }
}`;
         return {
            code,
            imports,
            schema: schema_layout,
            internal_dependencies
         };
      }

      let element_view_class_name: string;
      let public_element_type: string;

      imports.add('DynamicSetOf');

      const result = strategy.get_or_generate_view_and_schema_for_type(element_type_str);

      element_view_class_name = result.class_name;

      if (element_view_class_name.startsWith('___intr_View_')) {
         internal_dependencies.add(element_view_class_name);
      }

      imports.add(element_type_str);

      if (element_type_node.kind === 'identifier') {
         public_element_type = element_view_class_name;
      } else if (element_type_node.kind === 'fixed_array') {
         const fa_node = element_type_node as FixedArrayTypeNode;
         const fa_element_type_str = stringify_type_node(fa_node.element_type);
         const fa_element_ts_type = FIXED_PRIMITIVE_TYPE_DETAILS.get(fa_element_type_str)?.ts_type ?? 'any';

         public_element_type = `[${new Array(fa_node.count).fill(fa_element_ts_type).join(', ')}]`;
      } else {
         public_element_type = element_view_class_name;
      }

      const add_override = `\
   override add(value: ${public_element_type}): this {
      const temp_view_size = ${element_view_class_name}.__schema.total_size;

      const temp_ptr = this.__allocator.allocate(
         temp_view_size,
         //
         this.constructor as IViewConstructor,
         this.__owner_allocation_ptr
      );

      try {
         const temp_view = new ${element_view_class_name}(
            this.__allocator.buffer,
            temp_ptr,
            this.__allocator,
            //
            this.constructor as IViewConstructor,
            this.__owner_allocation_ptr
         );

         temp_view.$copy_from(value);

         super.add(temp_view);
      } finally {
         this.__allocator.free(temp_ptr);
      }
      
      return this;
   }\
`;

      const has_override = `\
   override has(value: ${public_element_type}): boolean {
      const temp_view_size = ${element_view_class_name}.__schema.total_size;

      const temp_ptr = this.__allocator.allocate(
         temp_view_size,
         //
         this.constructor as IViewConstructor,
         this.__owner_allocation_ptr
      );
      
      try {
         const temp_view = new ${element_view_class_name}(
            this.__allocator.buffer,
            temp_ptr,
            this.__allocator,
            //
            this.constructor as IViewConstructor,
            this.__owner_allocation_ptr
         );

         temp_view.$copy_from(value);

         return super.has(temp_view);
      } finally {
         this.__allocator.free(temp_ptr);
      }
   }\
`;

      const delete_override = `\
   override delete(value: ${public_element_type}): boolean {
      const temp_view_size = ${element_view_class_name}.__schema.total_size;

      const temp_ptr = this.__allocator.allocate(
         temp_view_size,
         //
         this.constructor as IViewConstructor,
         this.__owner_allocation_ptr
      );
      
      try {
         const temp_view = new ${element_view_class_name}(
            this.__allocator.buffer,
            temp_ptr,
            this.__allocator,
            //
            this.constructor as IViewConstructor,
            this.__owner_allocation_ptr
         );

         temp_view.$copy_from(value);

         return super.delete(temp_view);
      } finally {
         this.__allocator.free(temp_ptr);
      }
   }\
`;

      const code = `\
export class ${class_name} extends DynamicSetOf<${element_view_class_name}> {

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

${add_override}

${has_override}

${delete_override}
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
      const prop_key_str = String(property_layout.property_key);
      const element_type_str = property_layout.binary_info.element_type!;

      const is_optional = property_layout.binary_info.is_optional;
      const view_type_info = strategy.get_or_generate_view_and_schema_for_type(property_layout.type);
      const view_type = view_type_info.class_name;

      let value_ts_type: string;

      if (element_type_str === 'str') {
         value_ts_type = 'string';
      } else if (FIXED_PRIMITIVE_TYPES.has(element_type_str)) {
         value_ts_type = FIXED_PRIMITIVE_TYPE_DETAILS.get(element_type_str)!.ts_type;
      } else {
         const element_view_info = strategy.get_or_generate_view_and_schema_for_type(element_type_str);

         value_ts_type = element_view_info.class_name;
      }

      const setter_param = is_optional
         ? `value?: Set<${value_ts_type}> | ${view_type}`
         : `value: Set<${value_ts_type}> | ${view_type}`;

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
      const private_prop_name = `#${prop_key_str}_view_${variant.type_string.replace(/<|>/g, '_')}`;

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
      if (value instanceof ${view_class_name} || value instanceof Map) {
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