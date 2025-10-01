/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/codegen/propgen/composites/tuple/index.ts
 */

import type { PropertyLayout, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';
import type { ICodegenStrategy, IPropertyCodegen } from '@eldritch-engine/type-utils/guerrero/codegen';
import type { TypeNode, TupleTypeNode } from '@eldritch-engine/type-utils/guerrero/parser';

import { TypeParser, stringify_type_node } from '@eldritch-engine/guerrero-core/layout/parser/parser';
import { generate_schema_layout_code } from '@eldritch-engine/guerrero-core/utils/schema';
import { align_offset } from '@eldritch-engine/guerrero-core/layout/calculator';
import { FIXED_PRIMITIVE_TYPE_DETAILS } from '@eldritch-engine/guerrero-core/layout/constants';

export class TuplePropgen implements IPropertyCodegen {

   can_handle(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): boolean {
      return property_layout.binary_info.is_tuple ?? false;
   }

   can_handle_as_standalone(
      type_node: TypeNode
   ): boolean {
      return type_node.kind === 'tuple';
   }

   get_required_imports(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): Set<string> {
      const imports = new Set<string>();

      if (!property_layout.binary_info.element_schemas) {
         return imports;
      }

      for (const element_schema of property_layout.binary_info.element_schemas) {
         const element_type_str = element_schema.class_name!;
         const resolved = strategy.resolver.resolve(element_type_str);

         const mock_layout = {
            type: element_type_str,
            binary_info: resolved.binary_type_info
         } as PropertyLayout;

         const propgen = strategy.propgens.find((p) => {
            return p.can_handle(strategy, mock_layout);
         });

         if (propgen) {
            for (const imp of propgen.get_required_imports(strategy, mock_layout)) {
               imports.add(imp);
            }
         }
      }

      return imports;
   }

   generate_private_view_field(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);
      const private_prop_name = `#${prop_key_str}_view`;
      const view_type_info = strategy.get_or_generate_view_and_schema_for_type(property_layout.type);

      return `\
   ${private_prop_name}?: ${view_type_info.class_name};
`;
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
      const is_optional = property_layout.binary_info.is_optional;
      const return_type = is_optional ? `${view_type} | undefined` : view_type;

      const constructor_call = `\
new ${view_type}(
            this.__buffer,
            data_offset,
            this.__allocator,
            ${class_name},
            this.__byte_offset
         )\
`;

      if (is_optional) {
         return `\
   get ${prop_key_str}(): ${return_type} {
      const prop_schema = ${class_name}.__schema.properties[${property_layout.order}]!;
      const presence_flag = this.__view.getUint8(this.__byte_offset + prop_schema.offset);

      if (presence_flag === 0) {
         return;
      }

      if (this.${private_prop_name} == null) {
         const data_offset = (this.__byte_offset + prop_schema.offset + 1 + (prop_schema.alignment - 1)) & ~(prop_schema.alignment - 1);

         this.${private_prop_name} = ${constructor_call};
      }

      return this.${private_prop_name};
   }\
`;
      } else {
         return `\
   get ${prop_key_str}(): ${return_type} {
      if (this.${private_prop_name} == null) {
         const prop_schema = ${class_name}.__schema.properties[${property_layout.order}]!;

         const data_offset = this.__byte_offset + prop_schema.offset;

         this.${private_prop_name} = ${constructor_call};
      }

      return this.${private_prop_name};
   }\
`;
      }
   }

   generate_setter(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string {
      const setter_access = property_layout.read_only ? 'private set' : 'set';
      const prop_key_str = String(property_layout.property_key);
      const is_optional = property_layout.binary_info.is_optional;
      const view_type_info = strategy.get_or_generate_view_and_schema_for_type(property_layout.type);
      const setter_type = `Iterable<any> | ${view_type_info.class_name}` + (is_optional ? ' | null' : '');

      const optional_logic = is_optional ? `\
      const prop_schema = ${class_name}.__schema.properties[${property_layout.order}]!;

      if (value == null) {
         this.${prop_key_str}?.free?.();

         this.__view.setUint8(this.__byte_offset + prop_schema.offset, 0);

         return;
      }

      this.__view.setUint8(this.__byte_offset + prop_schema.offset, 1);\
` : '';

      return `\
   ${setter_access} ${prop_key_str}(value: ${setter_type}) {
${optional_logic}

      this.${prop_key_str}.$copy_from(value);
   }`;
   }

   generate_free_statement(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined {
      if (!property_layout.binary_info.has_dynamic_data) {
         return;
      }

      const prop_key_str = String(property_layout.property_key);

      return `\
      this.${prop_key_str}?.free?.();
`;
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
      if (type_node.kind !== 'tuple') {
         throw new Error('TuplePropgen can only handle TupleTypeNode');
      }

      const tuple_node = type_node as TupleTypeNode;
      const { element_layouts, total_size, max_alignment, has_dynamic_data } = this.#calculate_tuple_layout(strategy, tuple_node);

      const imports = new Set<string>([
         'IView',
         'SchemaLayout',
         'Pointer',
         'TlsfAllocator',
         'IViewConstructor',
         'IHashable',
      ]);

      const internal_dependencies = new Set<string>();

      let private_fields = '';
      let accessors = '';
      let copy_statements = '';
      let free_statements = '';
      let hash_statements = '';
      let equals_statements = '';

      for (let i = 0; i < element_layouts.length; i++) {
         const layout = element_layouts[i]!;

         const propgen = strategy.propgens.find(
            (p) => {
               const mock_layout = {
                  type: layout.type,
                  binary_info: layout.binary_info
               } as PropertyLayout;

               return p.can_handle(strategy, mock_layout);
            }
         );

         if (!propgen) {
            throw new Error(`no propgen found for tuple element type ${layout.type}`);
         }

         const mock_prop_layout: PropertyLayout = {
            property_key: `_${i}`,
            type: layout.type,
            order: i,
            offset: layout.offset,
            size: layout.size,
            alignment: layout.alignment,
            binary_info: layout.binary_info
         };

         for (const imp of propgen.get_required_imports(strategy, mock_prop_layout)) {
            imports.add(imp);
         }

         private_fields += propgen.generate_private_view_field?.(strategy, mock_prop_layout) ?? '';
         accessors += propgen.generate_getter(strategy, mock_prop_layout, class_name) + '\n\n';
         accessors += propgen.generate_setter(strategy, mock_prop_layout, class_name) + '\n\n';

         const element_view_info = strategy.get_or_generate_view_and_schema_for_type(layout.type);
         if (element_view_info.class_name.startsWith('___intr_View_')) {
            internal_dependencies.add(element_view_info.class_name);
         }

         const details = FIXED_PRIMITIVE_TYPE_DETAILS.get(layout.type);
         const ts_type = details ? details.ts_type : element_view_info.class_name;

         accessors += `
   get [${i}]() {
      return this._${i};
   }

   set [${i}](value: ${ts_type}) {
      this._${i} = value;
   }
`;
         copy_statements += `\
      this[${i}] = source[${i}];
`;
         const free = propgen.generate_free_statement?.(strategy, mock_prop_layout, class_name);
         const hash = propgen.generate_hash_statement?.(strategy, mock_prop_layout, class_name);
         const equals = propgen.generate_equals_statement?.(strategy, mock_prop_layout, class_name);

         free_statements += free ? free + '\n' : '';
         hash_statements += hash ? hash + '\n' : '';
         equals_statements += equals ? equals + '\n\n' : '';
      }

      const schema_layout: SchemaLayout = {
         class_name,
         total_size,
         alignment: max_alignment,
         properties: element_layouts.map((el, i) => ({ ...el, property_key: String(i), order: i })),
         has_dynamic_data
      };

      const schema_code = generate_schema_layout_code(strategy, schema_layout);

      const free_method = has_dynamic_data ? `\
   free() {
${free_statements.trimEnd()}
   }` : '';

      const hash_method = `\
   $hash(): number {
      let hash = 17;

${hash_statements.trimEnd()}

      return hash;
   }
`;

      const equals_method = `\
   $equals(other: this): boolean {
      if (this === other) {
         return true;
      }

${equals_statements.trimEnd()}

      return true;
   }
`;

      const code = `
export class ${class_name} implements IView, IHashable, Iterable<any> {

   static readonly __schema: SchemaLayout = ${schema_code};

   readonly __view!: DataView;
   readonly __buffer!: ArrayBufferLike;
   readonly __byte_offset!: Pointer;
   readonly __allocator?: TlsfAllocator;

   readonly __owner_constructor?: IViewConstructor<IView>;
   readonly __owner_allocation_ptr?: Pointer;

${private_fields}

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator?: TlsfAllocator,
      //
      owner_constructor?: IViewConstructor<IView>,
      owner_allocation_ptr?: Pointer
   ) {
      this.__buffer = buffer;
      this.__byte_offset = byte_offset;
      this.__allocator = allocator;
      this.__view = new DataView(buffer);

      this.__owner_constructor = owner_constructor;
      this.__owner_allocation_ptr = owner_allocation_ptr;
   }

   get length(): number {
      return ${element_layouts.length};
   }
   
${accessors}

   *[Symbol.iterator]() {
      for (let i = 0; i < this.length; i++) {
         yield this[i];
      }
   }

   *entries(): IterableIterator<[number, any]> {
      for (let i = 0; i < this.length; i++) {
         yield [i, this[i]];
      }
   }

   *keys(): IterableIterator<number> {
      for (let i = 0; i < this.length; i++) {
         yield i;
      }
   }

   values(): IterableIterator<any> {
      return this[Symbol.iterator]();
   }

   $copy_from(source: any) {
${copy_statements.trimEnd()}
   }

${free_method.trimEnd()}

${hash_method.trimEnd()}

${equals_method.trimEnd()}
}`;

      return {
         code,
         imports,
         schema: schema_layout,
         internal_dependencies
      };
   }

   #calculate_tuple_layout(
      strategy: ICodegenStrategy,
      tuple_node: TupleTypeNode
   ) {
      let current_offset = 0;
      let max_alignment = 1;
      let has_dynamic_data = false;

      const element_layouts: (Omit<PropertyLayout, 'property_key' | 'order'>)[] = [];

      for (const element_type_node of tuple_node.element_types) {
         const type_string = stringify_type_node(element_type_node);
         const resolved = strategy.resolver.resolve(type_string);
         const element_info = resolved.binary_type_info;

         max_alignment = Math.max(max_alignment, element_info.alignment);

         if (element_info.has_dynamic_data) {
            has_dynamic_data = true;
         }

         current_offset = align_offset(current_offset, element_info.alignment);

         element_layouts.push({
            type: type_string,
            offset: current_offset,
            size: element_info.size,
            alignment: element_info.alignment,
            binary_info: element_info
         });

         current_offset += element_info.size;
      }

      const total_size = align_offset(current_offset, max_alignment);

      return {
         element_layouts,
         total_size,
         max_alignment,
         has_dynamic_data
      };
   }
}