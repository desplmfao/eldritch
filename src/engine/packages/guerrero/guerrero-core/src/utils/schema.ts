/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/src/utils/schema.ts
 */

import type { SchemaLayout, PropertyLayout, BinaryTypeInfo, UnionVariantMetadata } from '@eldritch-engine/type-utils/guerrero/index';
import type { ICodegenStrategy } from '@eldritch-engine/type-utils/guerrero/codegen';

// TODO: don't hard code this over and over
const GUERRERO_MARKER_IDENTIFIERS = new Set([
   'u8',
   'u16',
   'u32',
   'u64',
   'i8',
   'i16',
   'i32',
   'i64',
   'f32',
   'f64',
   'bool',
   'str',
   'sparseset'
]);

export function escape_string_for_code(
   str: string | symbol | undefined
): string {
   if (str == null) {
      return 'undefined';
   }

   if (typeof str === 'symbol') {
      return `Symbol.for('${String(str.description).replace(/'/g, "\\'")}')`;
   }

   const escaped = str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');

   return `'${escaped}'`;
}

function generate_union_variants_code(
   strategy: ICodegenStrategy,
   variants: UnionVariantMetadata[],
   indent_level: number
): string {
   const indent_unit = '   ';
   const p_indent = indent_unit.repeat(indent_level + 1);
   const c_indent = indent_unit.repeat(indent_level + 2);

   return `\
[
${variants.map(v => `\
${p_indent}{
${c_indent}type_string: ${escape_string_for_code(v.type_string)},
${c_indent}tag: ${v.tag},
${c_indent}binary_info: ${generate_binary_type_info_code(strategy, v.binary_info, indent_level + 2)}
${p_indent}}\
`).join(',\n')}
${indent_unit.repeat(indent_level)}]\
`;
}

function generate_binary_type_info_code(
   strategy: ICodegenStrategy,
   bti: BinaryTypeInfo,
   indent_level: number
): string {
   const indent_unit = '   ';
   const p_indent = indent_unit.repeat(indent_level + 1);
   const lines: string[] = [];

   if (bti.size != null) lines.push(`${p_indent}size: ${bti.size},`);
   if (bti.alignment != null) lines.push(`${p_indent}alignment: ${bti.alignment},`);
   if (bti.element_count != null) lines.push(`${p_indent}element_count: ${bti.element_count},`);
   if (bti.is_nested_struct) lines.push(`${p_indent}is_nested_struct: true,`);
   if (bti.is_dynamic) lines.push(`${p_indent}is_dynamic: true,`);
   if (bti.has_dynamic_data) lines.push(`${p_indent}has_dynamic_data: true,`);
   if (bti.is_optional) lines.push(`${p_indent}is_optional: true,`);
   if (bti.is_ptr) lines.push(`${p_indent}is_ptr: true,`);
   if (bti.is_enum) lines.push(`${p_indent}is_enum: true,`);
   if (bti.is_tuple) lines.push(`${p_indent}is_tuple: true,`);

   const debug_lines: string[] = [];

   if (bti.key_type != null) debug_lines.push(`${p_indent}key_type: ${escape_string_for_code(bti.key_type)},`);
   if (bti.element_type != null) debug_lines.push(`${p_indent}element_type: ${escape_string_for_code(bti.element_type)},`);

   if (bti.key_schema != null) {
      strategy.get_or_generate_view_and_schema_for_type(bti.key_type!);
      const resolved_name = strategy.get_type_name_for_codegen(bti.key_schema.class_name!);

      debug_lines.push(`${p_indent}key_schema: ${generate_schema_layout_code(strategy, bti.key_schema, resolved_name, indent_level + 1)},`);
   }

   if (bti.element_schema != null) {
      strategy.get_or_generate_view_and_schema_for_type(bti.element_type!);
      const resolved_name = strategy.get_type_name_for_codegen(bti.element_schema.class_name!);

      debug_lines.push(`${p_indent}element_schema: ${generate_schema_layout_code(strategy, bti.element_schema, resolved_name, indent_level + 1)},`);
   }

   if (bti.is_union) {
      debug_lines.push(`${p_indent}is_union: true,`);

      if (bti.variants != null) {
         for (const variant of bti.variants) {
            strategy.get_or_generate_view_and_schema_for_type(variant.type_string)
         }

         debug_lines.push(`${p_indent}variants: ${generate_union_variants_code(strategy, bti.variants, indent_level + 1)},`);
      }
   }

   if (bti.element_schemas != null) {
      const schemas_code = bti.element_schemas.map(s => {
         strategy.get_or_generate_view_and_schema_for_type(s.class_name!);
         const resolved_name = strategy.get_type_name_for_codegen(s.class_name!);

         return generate_schema_layout_code(strategy, s, resolved_name, indent_level + 2);
      }).join(`,\n${p_indent}${indent_unit}`);

      debug_lines.push(`${p_indent}element_schemas: [\n${p_indent}${indent_unit}${schemas_code}\n${p_indent}],`);
   }

   if (debug_lines.length > 0) {
      lines.push(`${p_indent}/// #if DEBUG`);
      lines.push(...debug_lines);
      lines.push(`${p_indent}/// #endif`);
   }

   return `{\n${lines.join('\n')}\n${indent_unit.repeat(indent_level)}}`;
}

function generate_property_layout_code(
   strategy: ICodegenStrategy,
   prop_layout: PropertyLayout,
   indent_level: number
): string {
   const indent_unit = '   ';
   const p_indent = indent_unit.repeat(indent_level + 1);

   const debug_lines: string[] = [];

   debug_lines.push(`${p_indent}property_key: ${escape_string_for_code(prop_layout.property_key)},`);

   if (prop_layout.display_name != null) debug_lines.push(`${p_indent}display_name: ${escape_string_for_code(prop_layout.display_name)},`);
   if (prop_layout.description != null) debug_lines.push(`${p_indent}description: ${escape_string_for_code(prop_layout.description)},`);
   if (prop_layout.serializable != null) debug_lines.push(`${p_indent}serializable: ${prop_layout.serializable},`);
   if (prop_layout.read_only != null) debug_lines.push(`${p_indent}read_only: ${prop_layout.read_only},`);

   debug_lines.push(`${p_indent}order: ${prop_layout.order},`);
   debug_lines.push(`${p_indent}type: ${escape_string_for_code(prop_layout.type)},`);

   if (prop_layout.start_line != null) debug_lines.push(`${p_indent}start_line: ${prop_layout.start_line},`);
   if (prop_layout.end_line != null) debug_lines.push(`${p_indent}end_line: ${prop_layout.end_line},`);
   if (prop_layout.enum_members != null) debug_lines.push(`${p_indent}enum_members: [${prop_layout.enum_members.map(m => `{ name: '${m.name}', value: ${m.value} }`).join(', ')}],`);
   if (prop_layout.bit_offset != null) debug_lines.push(`${p_indent}bit_offset: ${prop_layout.bit_offset},`);
   if (prop_layout.bit_width != null) debug_lines.push(`${p_indent}bit_width: ${prop_layout.bit_width},`);

   const essential_lines: string[] = [];

   essential_lines.push(`${p_indent}offset: ${prop_layout.offset},`);
   essential_lines.push(`${p_indent}size: ${prop_layout.size},`);
   essential_lines.push(`${p_indent}alignment: ${prop_layout.alignment},`);

   if (prop_layout.default_value != null) {
      essential_lines.push(`${p_indent}default_value: ${strategy.generate_default_value_string(prop_layout.default_value, prop_layout)},`);
   }

   essential_lines.push(`${p_indent}binary_info: ${generate_binary_type_info_code(strategy, prop_layout.binary_info, indent_level + 1)}`);

   return `\
${p_indent}/// #if DEBUG
${debug_lines.join('\n')}
${p_indent}/// #endif
${essential_lines.join('\n')}\
`;
}

export function generate_schema_layout_code(
   strategy: ICodegenStrategy,
   layout: SchemaLayout,
   class_ctor_name: string = layout.class_name!,
   indent_level: number = 1
): string {
   const indent_unit = '   ';
   const p_indent = indent_unit.repeat(indent_level + 1);
   const c_indent = indent_unit.repeat(indent_level + 2);
   const base_indent = indent_unit.repeat(indent_level);

   const properties_code = `[\n${layout.properties.map(
      (prop_layout) => `${c_indent}{\n${generate_property_layout_code(strategy, prop_layout, indent_level + 2)}\n${c_indent}}`
   ).join(',\n')}\n${p_indent}]`;

   const is_complex_type_string = /[<>[\]|]/.test(class_ctor_name);
   const is_marker_identifier = GUERRERO_MARKER_IDENTIFIERS.has(class_ctor_name);
   const is_type_only = is_marker_identifier || is_complex_type_string;

   const class_info_line = is_type_only
      ? '' // fuckkkk, whats a class_name???? - don't add in runtime!
      : `${p_indent}class_ctor: ${class_ctor_name},`;

   return `{
${p_indent}/// #if DEBUG
${class_info_line}
${p_indent}/// #endif
${p_indent}total_size: ${layout.total_size},
${p_indent}alignment: ${layout.alignment},
${p_indent}has_dynamic_data: ${layout.has_dynamic_data},
${p_indent}properties: ${properties_code}
${base_indent}}`;
}

export function sanitize_type_for_name(
   type_string: string,
   user_type_name_map: Map<string, string> = new Map()
): string {
   let processed_string = type_string;

   for (const [name, sanitized_path] of user_type_name_map) {
      const regex = new RegExp(`\\b${name}\\b`, 'g');

      processed_string = processed_string.replace(regex, sanitized_path);
   }

   return processed_string
      .replace(/<|>/g, '_')
      .replace(/\[\]/g, '_arr')
      .replace(/\[|\]/g, '')
      .replace(/\(|\)/g, '_')
      .replace(/, /g, '_')
      .replace(/ /g, '')
      .replace(/\|/g, '_or_')
      .replace(/:/g, '_')
      .replace(/\//g, '_')
      .replace(/\./g, '_')
      .replace(/-/g, '_');
}