/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/src/visitors/reflect_metadata_visitor.ts
 */

import { Visitor } from '@swc/core/Visitor.js';
import * as swc from '@swc/core';

import type { ImportInfo } from '@eldritch-engine/type-utils/tddi/index';
import type { MetadataProperty, MetadataClassExtracted } from '@eldritch-engine/type-utils/guerrero/index';
import { FileOrigin } from '@eldritch-engine/type-utils/builder/origin';

import { TypeParser } from '@self/layout/parser/parser';

export function create_decorator_option_error(
   option_name: string,
   expected_type_description: string,
   actual_type: string,
   class_name_for_context?: string
): Error {
   const context_msg = class_name_for_context ? ` in @Reflectable options for class '${class_name_for_context}'` : '';

   return new Error(`invalid type for decorator option '${option_name}'${context_msg}. expected ${expected_type_description}, but got '${actual_type}'`);
}

export class ReflectMetadataVisitor extends Visitor {
   source_code: string;

   collected_metadata: Map<string, MetadataClassExtracted & { has_manual_props?: boolean }> = new Map();
   collected_aliases: Map<string, string> = new Map();
   import_map: Map<string, ImportInfo>;

   current_class_metadata?: MetadataClassExtracted & { has_manual_props?: boolean };

   file_span_start: number = 0;
   file_path: string;
   file_origin: FileOrigin;

   warn_fn: (message: string) => void;
   log_fn: (message: string) => void;
   #verbose: boolean;

   #is_in_test_file: boolean;
   #local_constants = new Map<string, any>();

   constructor(
      source_code: string,
      import_map: Map<string, ImportInfo>,
      file_path: string,
      warn_fn: (message: string) => void,
      log_fn: (message: string) => void,
      verbose: boolean,
      file_origin: FileOrigin
   ) {
      super();

      this.source_code = source_code;
      this.import_map = import_map;
      this.file_path = file_path;
      this.warn_fn = warn_fn;
      this.log_fn = log_fn;
      this.#verbose = verbose;
      this.file_origin = file_origin;

      this.#is_in_test_file = file_path.includes('/tests/');
   }

   get_collected_metadata(): ReadonlyMap<string, MetadataClassExtracted> {
      return this.collected_metadata;
   }

   get_collected_aliases(): ReadonlyMap<string, string> {
      return this.collected_aliases;
   }

   #is_guerrero_marker_type(
      type_string: string
   ): boolean {
      try {
         new TypeParser(type_string).parse();

         return true;
      } catch (e) {
         return false;
      }
   }

   override visitTsType(
      node: swc.TsType
   ): swc.TsType {
      return node;
   }

   #extract_simple_literal(
      node: swc.Expression
   ): any {
      switch (node.type) {
         case 'StringLiteral':
         case 'NumericLiteral':
         case 'BooleanLiteral': {
            return node.value;
         }

         case 'NullLiteral': {
            return null;
         }

         case 'BigIntLiteral': {
            return BigInt((((node.raw ?? node.value) as string)).replace(/n$/, ''));
         }

         case 'UnaryExpression': {
            if (node.operator === '-') {
               const arg = this.#extract_simple_literal(node.argument);

               switch (typeof arg) {
                  case 'number':
                  case 'bigint': {
                     return -arg;
                  }
               }
            }

            return;
         }

         default: {
            return;
         }
      }
   }

   override visitModule(
      module: swc.Module
   ): swc.Module {
      this.current_class_metadata = undefined;
      this.file_span_start = module.span.start;
      this.#local_constants.clear();

      for (const item of module.body) {
         if (
            item.type === 'VariableDeclaration'
            && item.kind === 'const'
         ) {
            for (const decl of item.declarations) {
               if (
                  decl.id.type === 'Identifier'
                  && decl.init
               ) {
                  const value = this.#extract_simple_literal(decl.init);

                  if (value != null) {
                     this.#local_constants.set(decl.id.value, value);
                  }
               }
            }
         }
      }

      for (const item of module.body) {
         if (
            item.type === 'VariableDeclaration'
            && item.kind === 'const'
         ) {
            for (const decl of item.declarations) {
               if (
                  decl.id.type === 'Identifier'
                  && decl.init
                  && !this.#local_constants.has(decl.id.value)
               ) {
                  try {
                     const value = this.#get_literal_value(decl.init);

                     this.#local_constants.set(decl.id.value, value);
                  } catch (e) {
                     // ignore
                  }
               }
            }
         }
      }

      return super.visitModule(module);
   }

   override visitScript(
      script: swc.Script
   ): swc.Script {
      this.current_class_metadata = undefined;
      this.file_span_start = script.span.start;

      return super.visitScript(script);
   }

   override visitTsEnumDeclaration(
      decl: swc.TsEnumDeclaration
   ): swc.TsEnumDeclaration {
      let next_auto_value = 0;

      const enum_name = decl.id.value;
      const enum_members: {
         name: string;
         value: number
      }[] = [];

      for (const member of decl.members) {
         if (member.id.type !== 'Identifier') {
            if (!this.#is_in_test_file) {
               this.warn_fn(`unsupported enum member name type '${member.id.type}' in enum '${enum_name}'`);
            }

            continue;
         }

         const member_name = member.id.value;
         let member_value: number;

         if (
            member.init
            && member.init.type === 'NumericLiteral'
         ) {
            member_value = member.init.value;
            next_auto_value = member_value + 1;
         } else if (member.init) {
            if (!this.#is_in_test_file) {
               this.warn_fn(`unsupported initializer type '${member.init.type}' for enum member '${enum_name}.${member_name}'. only numeric literals are supported`);
            }

            continue;
         } else {
            member_value = next_auto_value;
            next_auto_value++;
         }

         enum_members.push({
            name: member_name,
            value: member_value
         });
      }

      if (this.#verbose) {
         this.log_fn(`found enum: '${enum_name}'`);
      }

      if (
         this.collected_metadata.has(enum_name)
         && !this.#is_in_test_file
      ) {
         this.warn_fn(`duplicate definition found for enum '${enum_name}'. the last one will be used`);
      }

      this.collected_metadata.set(
         enum_name,
         {
            class_name: enum_name,
            properties: [],
            is_reflectable: false,
            definition_type: 'enum',
            start_line: this.#get_line_number_from_offset(decl.span.start - this.file_span_start),
            end_line: this.#get_line_number_from_offset(decl.span.end - this.file_span_start),
            file_path: this.file_path,
            enum_members: enum_members,
            origin: this.file_origin,
         }
      );

      return decl;
   }

   override visitClassDeclaration(
      decl: swc.ClassDeclaration
   ): swc.ClassDeclaration {
      const class_name = decl.identifier.value;

      const reflectable_decorator = decl.decorators?.find(
         (d) => {
            return d.expression.type === 'CallExpression'
               && d.expression.callee.type === 'Identifier'
               && d.expression.callee.value === 'Reflectable';
         }
      );

      if (!reflectable_decorator) {
         return super.visitClassDeclaration(decl) as swc.ClassDeclaration;
      }

      if (this.#verbose) {
         this.log_fn(`found @Reflectable class: '${class_name}'`);
      }

      let definition_type: 'enum' | 'struct' | 'interface' = 'struct';
      let alias_for: string | undefined;
      let alias_mode: 'substitute' | 'extend' | undefined;

      if (
         reflectable_decorator.expression.type === 'CallExpression'
         && reflectable_decorator.expression.arguments.length > 0
      ) {
         const decorator_arg = reflectable_decorator.expression.arguments[0]?.expression;

         if (
            decorator_arg
            && decorator_arg.type === 'ObjectExpression'
         ) {
            const decorator_options = this.#extract_decorator_options(decorator_arg);

            if (decorator_options.definition_type) {
               definition_type = decorator_options.definition_type;
            }

            if (decorator_options.alias_for) {
               alias_for = decorator_options.alias_for;
            }

            if (decorator_options.alias_mode) {
               alias_mode = decorator_options.alias_mode;
            }
         }
      }

      const extends_type_names: string[] = [];

      if (
         decl.superClass
         && decl.superClass.type === 'Identifier'
      ) {
         extends_type_names.push(decl.superClass.value);
      }

      const implements_type_names: string[] = [];

      if (decl.implements) {
         for (const impl of decl.implements) {
            if (impl.expression.type === 'Identifier') {
               implements_type_names.push(impl.expression.value);
            }
         }
      }

      const class_start_line = this.#get_line_number_from_offset(decl.span.start - this.file_span_start);
      const class_end_line_offset = Math.max(decl.span.start, decl.span.end > 0 ? decl.span.end - 1 : decl.span.start);
      const class_end_line = this.#get_line_number_from_offset(class_end_line_offset - this.file_span_start);
      const has_constructor = decl.body.some(member => member.type === 'Constructor');

      if (!this.collected_metadata.has(class_name)) {
         this.collected_metadata.set(
            class_name,
            {
               class_name: class_name,
               properties: [],
               is_reflectable: true,
               definition_type: definition_type,
               extends_type_names: extends_type_names.length > 0 ? extends_type_names : undefined,
               implements_type_names: implements_type_names.length > 0 ? implements_type_names : undefined,
               start_line: class_start_line,
               end_line: class_end_line,
               file_path: this.file_path,
               has_manual_props: false,
               has_constructor: has_constructor,
               origin: this.file_origin,
               alias_for: alias_for,
               alias_mode: alias_mode,
            }
         );
      } else {
         const existing = this.collected_metadata.get(class_name)!;
         const is_existing_from_test = existing.file_path.includes('/tests/');

         if (
            is_existing_from_test
            && !this.#is_in_test_file
         ) {
         } else if (
            !is_existing_from_test
            && this.#is_in_test_file
         ) {
            return super.visitClassDeclaration(decl) as swc.ClassDeclaration;
         }

         existing.is_reflectable = true;
         existing.definition_type = definition_type;
         existing.extends_type_names = extends_type_names.length > 0 ? extends_type_names : undefined;
         existing.implements_type_names = implements_type_names.length > 0 ? implements_type_names : undefined;
         existing.start_line = class_start_line;
         existing.end_line = class_end_line;
         existing.file_path = this.file_path;
         existing.has_constructor = has_constructor;
         existing.origin = this.file_origin;
         existing.alias_for = alias_for;
         existing.alias_mode = alias_mode;
      }

      if (
         alias_for
         && alias_mode !== 'extend'
      ) {
         if (this.#verbose) {
            this.log_fn(`'${class_name}' is a substitute alias for '${alias_for}'. skipping property processing`);
         }

         return decl;
      }

      const previous_class_metadata = this.current_class_metadata;
      this.current_class_metadata = this.collected_metadata.get(class_name)!;

      const schema_props_member = decl.body.find(
         (member) => {
            return member.type === 'ClassProperty'
               && member.isStatic
               && member.key.type === 'Identifier'
               && member.key.value === '__schema_props';
         }
      );

      if (
         schema_props_member
         && schema_props_member.type === 'ClassProperty'
         && schema_props_member.value?.type === 'ArrayExpression'
      ) {
         const props = this.#extract_props_from_array_expression(
            schema_props_member.value.elements as swc.ExprOrSpread[],
            class_name
         );

         if (props) {
            for (const prop of props) {
               this.current_class_metadata.properties.push(prop);
            }

            this.current_class_metadata.has_manual_props = true;
         }
      }

      const result = super.visitClassDeclaration(decl);

      this.current_class_metadata = previous_class_metadata;

      return result as swc.ClassDeclaration;
   }

   override visitClassProperty(prop: swc.ClassProperty): swc.ClassProperty {
      if (
         !this.current_class_metadata
         || prop.accessibility === 'private'
         || prop.accessibility === 'protected'
         || prop.isStatic
         || prop.key.type !== 'Identifier'
      ) {
         return super.visitClassProperty(prop) as swc.ClassProperty;
      }

      const property_name = prop.key.value;
      const jsdoc_description = this.#extract_jsdoc_description(prop.span.start - this.file_span_start);

      if (this.current_class_metadata.has_manual_props) {
         const existing_prop_meta = this.current_class_metadata.properties.find(
            (p) => p.property_key === property_name
         );

         if (
            existing_prop_meta
            && !existing_prop_meta.description
            && jsdoc_description
         ) {
            existing_prop_meta.description = jsdoc_description;
         }

         return super.visitClassProperty(prop) as swc.ClassProperty;
      }

      let type_annotation_node = prop.typeAnnotation?.typeAnnotation;

      if (!type_annotation_node) {
         return super.visitClassProperty(prop) as swc.ClassProperty;
      }

      const decorator = prop.decorators?.find(
         (d) => {
            return d.expression.type === 'CallExpression'
               && d.expression.callee.type === 'Identifier'
               && d.expression.callee.value === 'ReflectProperty';
         }
      );

      let is_optional_from_ast = prop.isOptional || false;

      if (type_annotation_node.type === 'TsUnionType') {
         const non_null_types = type_annotation_node.types.filter(
            (t) => {
               if (t.type === 'TsKeywordType') {
                  if (
                     t.kind === 'null'
                     || t.kind === 'undefined'
                  ) {
                     is_optional_from_ast = true;

                     return false;
                  }
               }

               return true;
            }
         );

         if (non_null_types.length === 1) {
            type_annotation_node = non_null_types[0];
         }
      }

      let final_type_annotation_node = type_annotation_node;

      // check for the t<t> wrapper and unwrap it for the schema
      if (
         type_annotation_node
         && type_annotation_node.type === 'TsTypeReference'
         && type_annotation_node.typeName.type === 'Identifier'
         && (['t', 'guerrero_omit'].indexOf(type_annotation_node.typeName.value) > -1)
         && type_annotation_node.typeParams
         && type_annotation_node.typeParams.params.length === 1
      ) {
         final_type_annotation_node = type_annotation_node.typeParams.params[0]!;
      }

      const type_string = this.#type_node_to_string(final_type_annotation_node!);

      if (this.#verbose) {
         this.log_fn(`  --- property '${this.current_class_metadata.class_name}.${property_name}' -> raw type from source: '${type_string}'`);
      }

      const is_enum_type = this.collected_metadata.get(type_string)?.definition_type === 'enum';

      if (
         !decorator
         && !this.#is_guerrero_marker_type(type_string)
         && !is_enum_type
         && !this.collected_aliases.has(type_string)
      ) {
         if (
            type_string
            && this.current_class_metadata
         ) {
            this.warn_fn(`property '${this.current_class_metadata.class_name}.${property_name}' has type '${type_string}' which is not a valid guerrero type. it will be ignored by the codegen`);
         }

         return super.visitClassProperty(prop) as swc.ClassProperty;
      }

      let optional_metadata: Partial<MetadataProperty> = {};

      if (
         decorator
         && decorator.expression.type === 'CallExpression'
         && decorator.expression.arguments[0]?.expression.type === 'ObjectExpression'
      ) {
         optional_metadata = this.#extract_property_decorator_values(decorator.expression.arguments[0].expression, property_name);
      } else if (prop.value) {
         try {
            optional_metadata.default_value = this.#get_literal_value(prop.value);
         } catch (e) {
            throw new Error(`error parsing default value for property '${property_name}' in class '${this.current_class_metadata.class_name}': ${e.message}`, { cause: e });
         }
      }

      const prop_order = this.current_class_metadata.properties.length;

      const final_prop_metadata: MetadataProperty = {
         property_key: property_name,
         order: prop_order,
         type: type_string,
         start_line: this.#get_line_number_from_offset(prop.span.start - this.file_span_start),
         end_line: this.#get_line_number_from_offset(prop.span.end > 0 ? (prop.span.end - this.file_span_start - 1) : (prop.span.end - this.file_span_start)),
         ...optional_metadata,
         description: optional_metadata.description ?? jsdoc_description,
         read_only: prop.readonly || optional_metadata.read_only,
         is_optional: is_optional_from_ast,
      };

      this.current_class_metadata.properties.push(final_prop_metadata);

      return super.visitClassProperty(prop) as swc.ClassProperty;
   }

   #type_node_to_string(
      node: swc.TsType
   ): string {
      switch (node.type) {
         case 'TsTypeReference': {
            if (node.typeName.type === 'Identifier') {
               let type_name = node.typeName.value;

               if (node.typeParams) {
                  const params = node.typeParams.params.map(p => this.#type_node_to_string(p)).join(', ');

                  type_name += `<${params}>`;
               }

               return type_name;
            }

            // fallback for TsQualifiedName if it ever appears
            break;
         }

         case 'TsArrayType': {
            const element_type = this.#type_node_to_string(node.elemType);

            if (
               node.elemType.type === 'TsUnionType'
               || node.elemType.type === 'TsIntersectionType'
               || node.elemType.type === 'TsParenthesizedType'
            ) {
               return `(${element_type})[]`;
            }

            return `${element_type}[]`;
         }

         case 'TsKeywordType': {
            return node.kind;
         }

         case 'TsUnionType': {
            return node.types.map(t => this.#type_node_to_string(t)).join(' | ');
         }

         case 'TsTupleType': {
            return `[${node.elemTypes.map(et => this.#type_node_to_string(et.ty)).join(', ')}]`;
         }

         case 'TsParenthesizedType': {
            return `(${this.#type_node_to_string(node.typeAnnotation)})`;
         }

         case 'TsTypeLiteral': {
            return '{}';
         }

         case 'TsLiteralType': {
            const literal = node.literal;

            switch (literal.type) {
               case 'NumericLiteral': {
                  return String(literal.value);
               }

               case 'StringLiteral': {
                  return `'${literal.value}'`;
               }

               case 'BooleanLiteral': {
                  return String(literal.value);
               }

               case 'BigIntLiteral': {
                  return `${literal.value}n`;
               }

               default: {
                  return '';
               }
            }
         }

         default: {
            return '';
         }
      }

      // fallback (super super buggy!!!)
      console.warn(`!!! failed to use ast for extracting types, if guerrero fails to compile this is LIKELY WHY !!!`, node);

      const start = node.span.start - this.file_span_start;
      const end = node.span.end - this.file_span_start;
      const out = this.source_code.slice(start, end).trim();

      return out;
   }

   #get_line_number_from_offset(
      relative_offset: number
   ): number {
      if (relative_offset < 0) {
         return 1;
      }

      const valid_offset = Math.min(relative_offset, this.source_code.length);
      let line_number = 1;

      for (let i = 0; i < valid_offset; i++) {
         if (this.source_code[i] === '\n') {
            line_number++;
         }
      }

      return line_number;
   }

   #extract_jsdoc_description(
      relative_span_start: number
   ): string | undefined {
      const code_slice_before_node = this.source_code.substring(0, relative_span_start);

      const last_jsdoc_end_index = code_slice_before_node.lastIndexOf('*/');
      if (last_jsdoc_end_index === -1) {
         return;
      }

      const last_jsdoc_start_index = code_slice_before_node.lastIndexOf('/**', last_jsdoc_end_index);
      if (last_jsdoc_start_index === -1) {
         return;
      }

      const content_between = code_slice_before_node.substring(last_jsdoc_end_index + 2);
      if (content_between.trim() !== '') {
         return;
      }

      const comment_content = code_slice_before_node.substring(last_jsdoc_start_index + 3, last_jsdoc_end_index);
      const cleaned_lines = comment_content
         .split('\n')
         .map(line => line.trim().replace(/^\* ?/, ''))
         .filter(line => !line.trim().startsWith('@'));

      const description = cleaned_lines.join('\n').trim();

      return description || undefined;
   }

   #get_literal_value(
      node: swc.Expression
   ): any {
      switch (node.type) {
         case 'StringLiteral':
         case 'NumericLiteral':
         case 'BooleanLiteral': {
            return node.value;
         }

         case 'NullLiteral': {
            return null;
         }

         case 'BigIntLiteral': {
            return BigInt(((node.raw ?? node.value) as string).replace(/n$/, ''));
         }

         case 'Identifier': {
            if (this.#local_constants.has(node.value)) {
               return this.#local_constants.get(node.value);
            }

            return {
               __is_identifier: true,
               value: node.value
            };
         }

         case 'MemberExpression': {
            if (
               node.object.type === 'Identifier'
               && node.property.type === 'Identifier'
            ) {
               const enum_name = node.object.value;
               const member_name = node.property.value;
               const enum_meta = this.collected_metadata.get(enum_name);

               if (
                  enum_meta?.definition_type === 'enum'
                  && enum_meta.enum_members
               ) {
                  const member = enum_meta.enum_members.find(m => m.name === member_name);

                  if (member) {
                     return member.value;
                  }
               }
            }

            break;
         }

         case 'BinaryExpression': {
            const left = this.#get_literal_value(node.left);
            const right = this.#get_literal_value(node.right);

            if (
               typeof left === 'object'
               || typeof right === 'object'
            ) {
               throw new Error('cannot perform binary operations on object-like default values');
            }

            const left_val = typeof left === 'bigint' ? Number(left) : left;
            const right_val = typeof right === 'bigint' ? Number(right) : right;

            switch (node.operator) {
               case '+': return left_val + right_val;
               case '-': return left_val - right_val;
               case '*': return left_val * right_val;
               case '/': return left_val / right_val;
               case '%': return left_val % right_val;
               case '**': return left_val ** right_val;
               case '>': return left_val > right_val;
               case '<': return left_val < right_val;
               case '>=': return left_val >= right_val;
               case '<=': return left_val <= right_val;
               case '==': return left_val == right_val;
               case '!=': return left_val != right_val;
               case '===': return left_val === right_val;
               case '!==': return left_val !== right_val;

               default: {
                  throw new Error(`unsupported binary operator '${node.operator}' in default value`);
               }
            }
         }

         case 'UnaryExpression': {
            const arg_val = this.#get_literal_value(node.argument);

            if (node.operator === '-') {
               if (node.argument.type === 'BigIntLiteral') {
                  const raw_val = node.argument.raw!;

                  return -BigInt(raw_val.replace(/n$/, ''));
               }

               switch (typeof arg_val) {
                  case 'number':
                  case 'bigint': {
                     return -arg_val;
                  }
               }
            }

            if (node.operator === '!') {
               return !arg_val;
            }

            throw new Error(`unsupported unary operator '${node.operator}' in default value. only negation (-) and logical NOT (!) are supported`);
         }

         case 'ArrayExpression': {
            return node.elements.map(
               (el) => {
                  if (!el) {
                     return null;
                  }

                  if (el.spread) {
                     throw new Error('spread syntax is not supported in default values');
                  }

                  return this.#get_literal_value(el.expression);
               }
            );
         }

         case 'ObjectExpression': {
            const obj: Record<string, any> = {};

            for (const prop of node.properties) {
               if (prop.type === 'KeyValueProperty') {
                  let key: string;

                  if (prop.key.type === 'Identifier') {
                     key = prop.key.value;
                  } else if (prop.key.type === 'StringLiteral') {
                     key = prop.key.value;
                  } else {
                     throw new Error('only identifier or string literal keys are supported in default value objects');
                  }

                  obj[key] = this.#get_literal_value(prop.value);
               } else {
                  throw new Error('unsupported property type in default value object');
               }
            }

            return obj;
         }

         case 'ParenthesisExpression': {
            return this.#get_literal_value(node.expression);
         }

         default: {
            throw new Error(`unsupported expression type '${node.type}' in default value. only json-like literals, identifiers, and simple expressions are allowed`);
         }
      }

      throw new Error(`unsupported expression type '${node.type}' in default value. only json-like literals, identifiers, and simple expressions are allowed`);
   }

   #parse_prop_object_expression(
      obj: swc.ObjectExpression,
      class_name: string
   ): MetadataProperty | undefined {
      const meta: Partial<MetadataProperty> = {};

      for (const prop of obj.properties) {
         if (
            prop.type !== 'KeyValueProperty'
            || (
               prop.key.type !== 'Identifier'
               && prop.key.type !== 'StringLiteral'
            )
         ) {
            continue;
         }

         const key = prop.key.value;
         const value_node = prop.value;

         const value = this.#get_literal_value(value_node);

         if (value == null) {
            this.warn_fn(`unsupported value type '${value_node.type}' for property '${key}' in __schema_props of class '${class_name}'`);

            return;
         }

         meta[key as keyof typeof meta] = value;
      }

      if (
         typeof meta.property_key !== 'string'
         || typeof meta.type !== 'string'
         || typeof meta.order !== 'number'
      ) {
         this.warn_fn(`incomplete definition in __schema_props for class '${class_name}'. 'property_key', 'type', and 'order' are required`);

         return;
      }

      return meta as MetadataProperty;
   }

   #extract_props_from_array_expression(
      elements: (swc.ExprOrSpread | undefined)[],
      class_name: string
   ): MetadataProperty[] | undefined {
      const props: MetadataProperty[] = [];

      for (const element of elements) {
         if (
            !element
            || element.spread
         ) {
            this.warn_fn(`spread syntax is not supported in __schema_props for class '${class_name}'`);

            return;
         }

         if (element.expression.type !== 'ObjectExpression') {
            this.warn_fn(`invalid item in __schema_props for class '${class_name}'; expected an object literal`);

            return;
         }

         const prop = this.#parse_prop_object_expression(element.expression, class_name);

         if (!prop) {
            return;
         }

         props.push(prop);
      }

      return props;
   }

   #extract_decorator_options(
      obj: swc.ObjectExpression
   ): {
      definition_type?: 'enum' | 'struct' | 'interface';
      extends?: string[];
      implements?: string[];
      alias_for?: string;
      alias_mode?: 'substitute' | 'extend';
   } {
      const options: {
         definition_type?: 'enum' | 'struct' | 'interface';
         extends?: string[];
         implements?: string[];
         alias_for?: string;
         alias_mode?: 'substitute' | 'extend';
      } = {};

      const class_name_for_error_context = this.current_class_metadata?.class_name;

      for (const prop of obj.properties) {
         switch (prop.type) {
            case 'KeyValueProperty': {
               let key: string | undefined;

               if (prop.key.type === 'Identifier') {
                  key = prop.key.value;
               } else if (prop.key.type === 'StringLiteral') {
                  key = prop.key.value;
               }

               if (key == null) {
                  continue;
               }

               const value_node = prop.value;

               switch (key) {
                  case 'alias_for': {
                     if (value_node.type === 'StringLiteral') {
                        options.alias_for = value_node.value;
                     } else {
                        throw create_decorator_option_error(
                           'alias_for',
                           'a string literal',
                           value_node.type,
                           class_name_for_error_context
                        );
                     }

                     break;
                  }

                  case 'alias_mode': {
                     if (
                        value_node.type === 'StringLiteral'
                        && (
                           value_node.value === 'substitute'
                           || value_node.value === 'extend'
                        )
                     ) {
                        options.alias_mode = value_node.value;
                     } else {
                        throw create_decorator_option_error(
                           'alias_mode',
                           `a string literal ('substitute' or 'extend')`,
                           value_node.type,
                           class_name_for_error_context
                        );
                     }

                     break;
                  }

                  case 'definition_type': {
                     if (value_node.type === 'StringLiteral') {
                        if (
                           value_node.value === 'enum'
                           || value_node.value === 'struct'
                           || value_node.value === 'interface'
                        ) {
                           options.definition_type = value_node.value;
                        } else {
                           throw new Error(`invalid value for 'definition_type' in @Reflectable options for class '${class_name_for_error_context || 'UnknownClass'}'. expected 'enum', 'struct', or 'interface', but got '${value_node.value}'`);
                        }
                     } else {
                        throw create_decorator_option_error(
                           'definition_type',
                           `a string literal ('enum', 'struct', or 'interface')`,
                           value_node.type,
                           class_name_for_error_context
                        );
                     }
                     break;
                  }

                  case 'extends': {
                     if (value_node.type === 'StringLiteral') {
                        options.extends = [value_node.value];
                     } else if (value_node.type === 'ArrayExpression') {
                        const extends_values: string[] = [];

                        for (let i = 0; i < value_node.elements.length; i++) {
                           const el = value_node.elements[i];

                           if (el?.expression.type === 'StringLiteral') {
                              extends_values.push(el.expression.value);
                           } else {
                              throw create_decorator_option_error(
                                 `extends[${i}]`,
                                 'a string literal',
                                 el?.expression.type ?? 'undefined element',
                                 class_name_for_error_context
                              );
                           }
                        }

                        options.extends = extends_values;
                     } else {
                        throw create_decorator_option_error(
                           'extends',
                           'a string literal or an array of string literals',
                           value_node.type,
                           class_name_for_error_context
                        );
                     }
                     break;
                  }

                  case 'implements': {
                     if (value_node.type === 'ArrayExpression') {
                        const implements_values: string[] = [];

                        for (let i = 0; i < value_node.elements.length; i++) {
                           const el = value_node.elements[i];

                           if (el?.expression.type === 'StringLiteral') {
                              implements_values.push(el.expression.value);
                           } else {
                              throw create_decorator_option_error(
                                 `implements[${i}]`,
                                 'a string literal',
                                 el?.expression.type ?? 'undefined element',
                                 class_name_for_error_context
                              );
                           }
                        }

                        options.implements = implements_values;
                     } else {
                        throw create_decorator_option_error(
                           'implements',
                           'an array of string literals',
                           value_node.type,
                           class_name_for_error_context
                        );
                     }

                     break;
                  }
               }

               break;
            }

            case 'SpreadElement': {
               throw new Error(`spread syntax is not supported in @Reflectable options object for class '${class_name_for_error_context || 'UnknownClass'}'`);
            }

            default: {
               throw new Error(`unsupported property type '${prop.type}' in @Reflectable options for class '${class_name_for_error_context || 'UnknownClass'}'`);
            }
         }
      }

      return options;
   }


   #extract_property_decorator_values(
      obj: swc.ObjectExpression,
      property_name_for_context: string,
   ): Partial<MetadataProperty> {
      const metadata: Partial<MetadataProperty> = {};

      for (const prop of obj.properties) {
         if (prop.type === 'KeyValueProperty') {
            let key: string | undefined;

            if (prop.key.type === 'Identifier') {
               key = prop.key.value;
            } else if (prop.key.type === 'StringLiteral') {
               key = prop.key.value;
            }

            if (key == null) {
               continue;
            }

            const value_node = prop.value;

            switch (key) {
               case 'display_name':
               case 'description':
               case 'type': {
                  switch (value_node.type) {
                     case 'StringLiteral': {
                        metadata[key] = value_node.value;

                        break;
                     }

                     case 'TemplateLiteral': {
                        if (
                           value_node.expressions.length === 0
                           && value_node.quasis.length === 1
                        ) {
                           metadata[key] = value_node.quasis[0]?.raw;
                        } else {
                           throw new Error(`template literal with expressions not supported for metadata key '${key}'`);
                        }

                        break;
                     }
                  }

                  break;
               }

               case 'order':
               case 'bits': {
                  switch (value_node.type) {
                     case 'NumericLiteral': {
                        metadata[key] = value_node.value;

                        break;
                     }

                     case 'UnaryExpression': {
                        if (
                           value_node.operator === '-'
                           && value_node.argument.type === 'NumericLiteral'
                        ) {
                           metadata[key] = -value_node.argument.value;
                        }

                        break;
                     }
                  }

                  break;
               }

               case 'serializable':
               case 'read_only': {
                  if (value_node.type === 'BooleanLiteral') {
                     metadata[key] = value_node.value;
                  }

                  break;
               }

               case 'enum_base_type': {
                  if (
                     value_node.type === 'StringLiteral'
                     && ['u8', 'u16', 'u32'].indexOf(value_node.value) > -1
                  ) {
                     metadata[key] = value_node.value as 'u8' | 'u16' | 'u32';
                  } else {
                     this.warn_fn(`invalid value for 'enum_base_type'. expected 'u8', 'u16', or 'u32'`);
                  }

                  break;
               }

               case 'default_value': {
                  try {
                     metadata[key] = this.#get_literal_value(value_node);
                  } catch (e) {
                     throw new Error(`error parsing 'default_value' for property '${property_name_for_context}' in class '${this.current_class_metadata?.class_name ?? 'UnknownClass'}': ${e.message}`, { cause: e });
                  }

                  break;
               }

               default: {
                  throw new Error(`unexpected property key ${key} (${property_name_for_context}) in @ReflectProperty in class '${this.current_class_metadata?.class_name ?? 'UnknownClass'}'`);
               }
            }
         }
      }

      return metadata;
   }

   override visitTsTypeAliasDeclaration(
      decl: swc.TsTypeAliasDeclaration
   ): swc.TsTypeAliasDeclaration {
      const alias_name = decl.id.value;

      let type_annotation_node = decl.typeAnnotation;

      if (
         type_annotation_node.type === 'TsTypeReference'
         && type_annotation_node.typeName.type === 'Identifier'
         && type_annotation_node.typeName.value === 't'
         && type_annotation_node.typeParams?.params.length === 1
      ) {
         type_annotation_node = type_annotation_node.typeParams.params[0]!;
      }

      const target_type_string = this.#type_node_to_string(type_annotation_node);

      if (
         this.collected_aliases.has(alias_name)
         && !this.#is_in_test_file
      ) {
         this.warn_fn(`duplicate definition for type alias '${alias_name}'. the last one will be used`);
      }

      this.collected_aliases.set(alias_name, target_type_string);

      if (this.#verbose) {
         this.log_fn(`found type alias: '${alias_name}' -> '${target_type_string}'`);
      }

      return decl;
   }
}