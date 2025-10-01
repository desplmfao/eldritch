/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/src/codegen/factory.ts
 */

import { default as path } from 'node:path';

import { replace_line_range_in_content } from '@eldritch-engine/utils/std/string';

import type { MetadataClassExtracted, PropertyLayout, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';
import type { ICodegenStrategy, IPropertyCodegen } from '@eldritch-engine/type-utils/guerrero/codegen';
import type { TypeNode } from '@eldritch-engine/type-utils/guerrero/parser';
import { FileOrigin } from '@eldritch-engine/type-utils/builder/origin';
import type { IBuildTimeRegistry } from '@eldritch-engine/type-utils/builder/registry';
import type { ITypeResolver } from '@eldritch-engine/type-utils/builder/resolver';

import { generate_schema_layout_code, sanitize_type_for_name } from '@self/utils/schema';
import { TypeParser, stringify_type_node } from '@self/layout/parser/parser';

class CodegenError extends Error {
   constructor(
      message: string,
      readonly file_path: string,
      readonly class_name?: string,
      readonly property_key?: string | symbol
   ) {
      let full_message = `[guerrero codegen] ${message} in file '${file_path}'`;

      if (class_name) {
         full_message += ` for class '${class_name}'`;
      }

      if (property_key) {
         full_message += ` on property '${String(property_key)}'`;
      }

      super(full_message);

      this.name = 'CodegenError';
   }
}

export interface ClassModificationPlan {
   class_name: string;
   private_fields: string;
   private_static_fields: string;
   constructor_code: string;
   initialize_defaults_method_code?: string;
   free_method_code?: string;
   copy_from_method_code: string;
   hash_method_code?: string;
   equals_method_code?: string;
   schema_code: string;
   has_manual_props: boolean;
   extends_class?: string;
}

/**
 * base class for all guerrero code generation strategies
 *
 * this class handles the boilerplate logic for reading metadata, orchestrating property codegen, and managing internal dependencies and file transformations
 *
 * concrete strategy implementations should inherit from this base class and provide their specific property generators and runtime implementations
 */
export abstract class CodegenStrategyBase implements ICodegenStrategy {
   readonly generates_iview: boolean = true;

   abstract propgens: IPropertyCodegen[];

   project_root_path: string = '';
   guerrero_internal_views_path!: string;
   combined_import_map?: ReadonlyMap<string, string>;

   registry!: IBuildTimeRegistry;
   resolver!: ITypeResolver;

   alias_cache = new Map<string, string>();
   current_file_internal_imports?: Set<string>;
   current_file_origin?: FileOrigin;
   current_file_path?: string;

   file_local_imports = new Set<string>([
      'IView',
      'SchemaLayout',
      'Pointer',
      'IViewConstructor',
      'PropertyLayout',
      'TlsfAllocator',
      'LITTLE_ENDIAN',
      'GLOBAL_NULL_POINTER'
   ]);

   //
   //

   abstract generate_constructor_code(
      layout: SchemaLayout,
      class_name: string
   ): string;

   abstract generate_initialize_defaults_method_code(
      layout: SchemaLayout,
      class_name: string
   ): string | undefined;

   abstract generate_free_method_code(
      layout: SchemaLayout,
      class_name: string
   ): string | undefined;

   abstract generate_copy_from_method_code(
      layout: SchemaLayout
   ): string;

   abstract generate_hash_method_code(
      layout: SchemaLayout,
      class_name: string
   ): string | undefined;

   abstract generate_equals_method_code(
      layout: SchemaLayout,
      class_name: string
   ): string | undefined;


   abstract get_import_map(): ReadonlyMap<string, string>;

   //
   //

   get_user_type_name_map_for_sanitization(
      type_string: string
   ): Map<string, string> {
      const user_type_map = new Map<string, string>();
      const type_node = new TypeParser(type_string).parse();

      const visitor = (node: TypeNode) => {
         if (node.kind === 'identifier') {
            const origin = this.registry.get_type_origin(node.name);

            if (origin === FileOrigin.User) {
               const alias = this.get_alias_for_user_type(node.name);

               if (alias) {
                  user_type_map.set(node.name, alias);
               }
            }
         }

         if (
            'element_type' in node
            && node.element_type
         ) {
            visitor(node.element_type);
         }

         if (
            'element_types' in node
            && node.element_types
         ) {
            for (const element_type of node.element_types) {
               visitor(element_type);
            }
         }

         if (
            'key_type' in node
            && node.key_type
         ) {
            visitor(node.key_type);
         }

         if (
            'value_type' in node
            && node.value_type
         ) {
            visitor(node.value_type);
         }

         if (
            'variants' in node
            && node.variants
         ) {
            for (const variant of node.variants) {
               visitor(variant);
            }
         }
      };

      visitor(type_node);

      return user_type_map;
   }

   get_alias_for_user_type(
      type_name: string
   ): string | undefined {
      if (this.alias_cache.has(type_name)) {
         return this.alias_cache.get(type_name)!;
      }

      const metadata = this.registry.get_class_metadata(type_name);

      if (
         metadata
         && (
            metadata.origin === FileOrigin.User
            || metadata.is_reflectable
         )
      ) {
         const sanitized_path_part = path.relative(this.project_root_path, metadata.file_path).replace(/\.ts$/, '');
         const alias = `${sanitize_type_for_name(sanitized_path_part)}_${type_name}`;

         this.alias_cache.set(type_name, alias);

         return alias;
      }

      return;
   }

   get_type_name_for_codegen(
      type_name: string
   ): string {
      const metadata = this.registry.get_class_metadata(type_name);

      if (
         metadata
         && this.current_file_origin
         && metadata.origin === this.current_file_origin
      ) {

         return type_name;
      }

      const alias_target = this.registry.get_type_alias_target(type_name);

      if (
         alias_target
         && metadata?.alias_mode !== 'extend'
      ) {
         return this.get_or_generate_view_and_schema_for_type(alias_target).class_name;
      }

      const type_origin = this.registry.get_type_origin(type_name);

      if (
         this.current_file_origin === FileOrigin.Generated
         && (
            type_origin === FileOrigin.User
            || type_origin === FileOrigin.Engine
         )
      ) {
         const alias = this.get_alias_for_user_type(type_name);

         if (alias) {
            return alias;
         }
      }

      return type_name;
   }

   get_or_generate_view_and_schema_for_type(
      type_string: string
   ): {
      class_name: string;
      schema: SchemaLayout
   } {
      const alias_target = this.registry.get_type_alias_target(type_string);

      if (alias_target) {
         const metadata = this.registry.get_class_metadata(type_string);

         if (metadata?.alias_mode !== 'extend') {
            return this.get_or_generate_view_and_schema_for_type(alias_target);
         }
      }

      const metadata_map = this.registry.get_class_metadata(type_string);

      if (
         metadata_map?.is_reflectable
         && metadata_map?.definition_type === 'struct'
      ) {
         const alias = this.get_alias_for_user_type(type_string);
         const schema = this.registry.get_schema_layout(type_string);

         if (!schema) {
            throw new Error(`schema not found for user type: '${type_string}'`);
         }

         // if you are trying to use dynamic imports or whatever just from names
         // you are a really bad masochist (should get this checked) and your development workflow makes absolutely no sense
         // this shitty fix breaks your dreams....
         if (this.current_file_origin !== FileOrigin.Generated) {
            return {
               class_name: type_string,
               schema: schema
            };
         }

         return {
            class_name: alias ?? type_string,
            schema: schema
         };
      }

      const type_node = new TypeParser(type_string.trim()).parse();
      const canonical_type_string = stringify_type_node(type_node);
      const user_type_map = this.get_user_type_name_map_for_sanitization(canonical_type_string);
      const deterministic_class_name = `___intr_View_${sanitize_type_for_name(canonical_type_string, user_type_map)}`;

      const existing_view = this.registry.generated_internal_views.get(deterministic_class_name);

      if (existing_view) {
         const existing_layout = this.registry.layouts.get(deterministic_class_name);

         if (!existing_layout) {
            throw new Error(`internal view '${deterministic_class_name}' was generated but its layout was not cached`);
         }

         this.#add_internal_imports_recursively(deterministic_class_name);

         return {
            class_name: deterministic_class_name,
            schema: existing_layout
         };
      }

      const propgen = this.propgens.find(p => p.can_handle_as_standalone?.(type_node));

      if (!propgen?.generate_standalone_view_class) {
         const resolved = this.resolver.resolve(type_string);

         return {
            class_name: resolved.canonical_string,
            schema: {
               class_name: resolved.canonical_string,
               total_size: resolved.binary_type_info.size,
               alignment: resolved.binary_type_info.alignment,
               has_dynamic_data: resolved.binary_type_info.has_dynamic_data ?? false,
               properties: []
            }
         };
      }

      const original_origin = this.current_file_origin;

      try {
         this.current_file_origin = FileOrigin.Generated;

         const { code, imports, schema, internal_dependencies } = propgen.generate_standalone_view_class(
            this,
            type_node,
            deterministic_class_name
         );

         this.registry.generated_internal_views.set(deterministic_class_name, { code, imports, internal_dependencies });
         this.registry.layouts.set(deterministic_class_name, schema);

         this.#add_internal_imports_recursively(deterministic_class_name);

         return {
            class_name: deterministic_class_name,
            schema
         };
      } finally {
         this.current_file_origin = original_origin;
      }
   }

   async transform_source_code(
      layouts: ReadonlyMap<string, SchemaLayout>,
      metadata_map: ReadonlyMap<string, MetadataClassExtracted>,
      source_code: string,
      file_path: string
   ): Promise<{
      code: string;
      imports: Set<string>;
      internal_imports: Set<string>;
   }> {
      this.current_file_path = file_path;
      this.current_file_origin = this.registry.get_file_origin(file_path);
      this.current_file_internal_imports = new Set<string>();
      this.file_local_imports = new Set<string>([
         'IView',
         'SchemaLayout',
         'Pointer',
         'IViewConstructor',
         'PropertyLayout',
         'TlsfAllocator',
         'LITTLE_ENDIAN',
         'GLOBAL_NULL_POINTER'
      ]);

      const property_replacements = [];
      const class_modifications = new Map<string, ClassModificationPlan>();

      const alias_replacements: {
         start_line: number;
         end_line: number;
         new_content: string
      }[] = [];

      for (const metadata of metadata_map.values()) {
         if (
            metadata.alias_for
            && metadata.alias_mode !== 'extend'
         ) {
            const alias_name = metadata.class_name;
            const target_type_string = metadata.alias_for;
            const view_info = this.get_or_generate_view_and_schema_for_type(target_type_string);

            alias_replacements.push({
               start_line: metadata.start_line,
               end_line: metadata.end_line,
               new_content: `export { ${view_info.class_name} as ${alias_name} };`
            });

            continue;
         }

         if (!metadata.is_reflectable) {
            continue;
         }

         const layout = layouts.get(metadata.class_name);

         if (!layout) {
            throw new CodegenError(`schema layout not found for reflectable class. this indicates a problem with the analysis phase`, file_path, metadata.class_name);
         }

         if (metadata.has_manual_props) {
            const class_mod: ClassModificationPlan = {
               class_name: metadata.class_name,
               private_fields: '',
               private_static_fields: '',
               constructor_code: '',
               copy_from_method_code: '',
               schema_code: `   static readonly __schema: SchemaLayout = ${generate_schema_layout_code(this, layout)};\n`,
               has_manual_props: true,
            };

            class_modifications.set(metadata.class_name, class_mod);

            continue;
         }

         const class_mod: ClassModificationPlan = {
            class_name: metadata.class_name,
            private_fields: '',
            private_static_fields: '',
            constructor_code: '',
            free_method_code: this.generate_free_method_code(layout, metadata.class_name),
            copy_from_method_code: this.generate_copy_from_method_code(layout),
            hash_method_code: this.generate_hash_method_code(layout, metadata.class_name),
            equals_method_code: this.generate_equals_method_code(layout, metadata.class_name),
            schema_code: `   static readonly __schema: SchemaLayout = ${generate_schema_layout_code(this, layout)};\n`,
            has_manual_props: metadata.has_manual_props ?? false,
            initialize_defaults_method_code: this.generate_initialize_defaults_method_code(layout, metadata.class_name),
         };

         if (
            metadata.alias_for
            && metadata.alias_mode === 'extend'
         ) {
            const view_info = this.get_or_generate_view_and_schema_for_type(metadata.alias_for);

            class_mod.extends_class = view_info.class_name;
         }

         let private_fields_accumulator = '';
         let private_static_fields_accumulator = '';

         for (const prop_layout of layout.properties.values()) {
            const propgen = this.propgens.find(p => p.can_handle(this, prop_layout));

            if (!propgen) {
               throw new CodegenError(`no property generator (propgen) found to handle type '${prop_layout.type}'. ensure a suitable propgen is registered in the current strategy that can handle this type`, file_path, metadata.class_name, prop_layout.property_key);
            }

            for (const imp of propgen.get_required_imports(this, prop_layout)) {
               this.file_local_imports.add(imp);
            }

            private_fields_accumulator += propgen.generate_private_view_field?.(this, prop_layout) ?? '';
            private_static_fields_accumulator += propgen.generate_private_static_field?.(this, prop_layout) ?? '';

            const replacement_content = [
               propgen.generate_getter(this, prop_layout, metadata.class_name),
               propgen.generate_setter(this, prop_layout, metadata.class_name),
               propgen.generate_pointer_accessors?.(this, prop_layout, metadata.class_name)
            ].filter(Boolean).join('\n\n');

            if (
               typeof prop_layout.start_line !== 'number'
               || typeof prop_layout.end_line !== 'number'
            ) {
               throw new CodegenError(`property metadata is missing valid line information, which is required for code replacement. this may indicate an error in the metadata visitor`, file_path, metadata.class_name, prop_layout.property_key);
            }

            if (
               replacement_content
               && prop_layout.start_line
               && prop_layout.end_line
            ) {
               property_replacements.push({
                  start_line: prop_layout.start_line,
                  end_line: prop_layout.end_line,
                  new_content: replacement_content,
               });
            }
         }

         class_mod.private_fields = private_fields_accumulator;
         class_mod.private_static_fields = private_static_fields_accumulator;

         if (
            !metadata.has_constructor
            && !this.#has_ancestor_with_constructor(metadata.class_name)
            && !class_mod.extends_class
         ) {
            class_mod.constructor_code = this.generate_constructor_code(layout, metadata.class_name);
         }

         class_modifications.set(metadata.class_name, class_mod);
      }

      let modified_code = source_code;

      const all_replacements = [
         ...property_replacements,
         ...alias_replacements,
      ].sort((a, b) => b.start_line - a.start_line);

      for (const replacement of all_replacements) {
         modified_code = replace_line_range_in_content(modified_code, replacement);
      }

      // remove any lingering original property declarations
      for (const layout of layouts.values()) {
         for (const prop_layout of layout.properties.values()) {
            const prop_key_str = String(prop_layout.property_key);
            const cleanup_regex = new RegExp(`^[ \t]*${prop_key_str}\\s*(!|\\?)?\\s*:[^;]+;[ \t]*$`, 'm');

            modified_code = modified_code.replace(cleanup_regex, '');
         }
      }

      for (const [class_name, mod] of class_modifications) {
         if (mod.extends_class) {
            modified_code = this.#inject_extends_clause(modified_code, class_name, mod.extends_class);
         }

         if (this.generates_iview) {
            modified_code = this.#inject_implements_iview(modified_code, class_name, mod);
         }

         const internals_to_inject = [
            mod.private_static_fields,
            mod.private_fields,
            mod.constructor_code,
         ].filter(Boolean).join('\n\n');

         if (internals_to_inject) {
            modified_code = this.#inject_at_class_start(modified_code, class_name, internals_to_inject);
         }

         if (mod.initialize_defaults_method_code) {
            modified_code = this.#inject_or_replace_method(modified_code, class_name, '#initialize_defaults', `   ${mod.initialize_defaults_method_code}`);
         }

         if (mod.free_method_code && !mod.extends_class) {
            modified_code = this.#inject_or_replace_method(modified_code, class_name, 'free', `   free(): void ${mod.free_method_code}`);
         }

         if (mod.copy_from_method_code && !mod.extends_class) {
            modified_code = this.#inject_or_replace_method(modified_code, class_name, '$copy_from', `   $copy_from(source: this): void ${mod.copy_from_method_code}`);
         }

         if (mod.hash_method_code && !mod.extends_class) {
            modified_code = this.#inject_or_replace_method(modified_code, class_name, '$hash', `   $hash(): number ${mod.hash_method_code}`);
         }

         if (mod.equals_method_code && !mod.extends_class) {
            modified_code = this.#inject_or_replace_method(modified_code, class_name, '$equals', `   $equals(other: this): boolean ${mod.equals_method_code}`);
         }

         if (mod.has_manual_props) {
            const schema_placeholder_regex = /static\s+(?:override\s+)?(?:readonly\s+)?__schema.*?GUERRERO_SCHEMA_PLACEHOLDER;?/s;
            const schema_props_regex = /\s*static\s+readonly\s+__schema_props(?::[\s\S]*?)?\s*=\s*\[[\s\S]*?\];?/s;
            const class_block_regex = new RegExp(`(class\\s+${class_name}[\\s\\S]*?})`, 'm');
            const class_block_match = modified_code.match(class_block_regex);

            if (class_block_match) {
               let class_block_content = class_block_match[1]!;

               if (schema_placeholder_regex.test(class_block_content)) {
                  class_block_content = class_block_content.replace(schema_placeholder_regex, mod.schema_code);
                  class_block_content = class_block_content.replace(schema_props_regex, '');

                  modified_code = modified_code.replace(class_block_match[1]!, class_block_content);
               } else {
                  throw new CodegenError(`class uses '__schema_props' but is missing the 'static readonly __schema: SchemaLayout = GUERRERO_SCHEMA_PLACEHOLDER;' field. this field is required for manual schema generation`, file_path, class_name);
               }
            }
         } else {
            modified_code = this.#inject_at_class_start(modified_code, class_name, mod.schema_code);
         }
      }

      modified_code = modified_code.replace(/^\s*@Reflectable\([^)]*\)\s*$/gm, '');
      modified_code = modified_code.replace(/^\s*@Reflectable\(\)\s*$/gm, '');
      modified_code = modified_code.replace(/^\s*@ReflectProperty\([^)]*\)\s*$/gm, '');

      const result = {
         code: modified_code,
         imports: this.file_local_imports,
         internal_imports: this.current_file_internal_imports ?? new Set<string>(),
      };

      this.current_file_path = undefined;
      this.current_file_internal_imports = undefined;
      this.current_file_origin = undefined;

      return result;
   }

   generate_default_value_string(
      value: any,
      layout: PropertyLayout
   ): string {
      const stringified_json = JSON.stringify(
         value,
         (k, v) => {
            if (typeof v === 'bigint') {
               return `${v.toString()}n`;
            }

            if (
               typeof v === 'object'
               && v !== null
               && v.__is_identifier === true
            ) {
               return `__GUERRERO_IDENTIFIER_${v.value}__`;
            }

            return v;
         }
      );

      return stringified_json
         .replace(/"__GUERRERO_IDENTIFIER_([^"]+)__"/g, '$1')
         .replace(/"(-?\d+)n"/g, '$1n');
   }

   #find_class_body_range(
      lines: string[],
      class_name: string
   ): {
      start_line: number;
      end_line: number
   } | undefined {
      const class_regex = new RegExp(`\\bclass\\s+${class_name}\\b`);
      const class_decl_line_index = lines.findIndex(line => class_regex.test(line));

      if (class_decl_line_index === -1) {
         return;
      }

      let brace_level = 0;
      let start_brace_line = -1;

      for (let i = class_decl_line_index; i < lines.length; i++) {
         const line = lines[i]!;

         for (const char of line) {
            if (char === '{') {
               if (brace_level === 0) {
                  start_brace_line = i;
               }

               brace_level++;
            } else if (char === '}') {
               brace_level--;

               if (
                  brace_level === 0
                  && start_brace_line !== -1
               ) {
                  return {
                     start_line: start_brace_line + 1,
                     end_line: i + 1
                  };
               }
            }
         }
      }

      return;
   }

   #inject_extends_clause(
      code: string,
      class_name: string,
      extends_class_name: string
   ): string {
      const class_sig_regex = new RegExp(`(class\\s+${class_name}(?:<[^>]+>)?)(?:\\s+extends\\s+([^{]+))?(\\s*{)`);

      const modified_code = code.replace(
         class_sig_regex,
         (
            match,
            class_declaration,
            existing_extends,
            open_brace
         ) => {
            if (existing_extends) {
               console.warn(`class '${class_name}' already has an 'extends' clause ('${existing_extends.trim()}'), but it is being overwritten by an 'alias_for' directive to extend '${extends_class_name}'`);
            }

            return `${class_declaration} extends ${extends_class_name}${open_brace}`;
         }
      );

      return modified_code;
   }

   #inject_implements_iview(
      code: string,
      class_name: string,
      mod: ClassModificationPlan
   ): string {
      if (mod.extends_class) {
         return code;
      }

      const class_sig_regex = new RegExp(`(class\\s+${class_name}(?:<[^>]+>)?)(?:\\s+extends\\s+((?:(?!implements|{).)+?))?(?:\\s*implements\\s+([^{,]+(?:\\s*,\\s*[^{,]+)*))?(\\s*{)`);

      return code.replace(
         class_sig_regex,
         (
            match,
            class_decl,
            extends_list,
            existing_implements_list,
            open_brace_with_space
         ) => {
            if (existing_implements_list?.split(',').map((s: string) => s.trim()).includes('IView')) {
               return match;
            }

            let final_code = class_decl;

            // does this also need something like below or nah?
            if (extends_list) {
               final_code += ` extends ${extends_list.trim()}`;
            }

            if (existing_implements_list) {
               final_code += ` implements ${existing_implements_list.trim()}, IView`;
            } else {
               final_code += ` implements IView`;
            }

            final_code += open_brace_with_space;

            return final_code;
         }
      );
   }

   #inject_at_class_start(
      code: string,
      class_name: string,
      content_to_inject: string
   ): string {
      const lines = code.split(/\r?\n/);
      const class_range = this.#find_class_body_range(lines, class_name);

      if (!class_range) {
         console.warn(`could not find class body for '${class_name}' to inject code. this can happen if the class is empty, malformed, or if the file contains syntax errors. the reflectable class will likely not function correctly`);

         return code;
      }

      lines.splice(class_range.start_line, 0, content_to_inject);

      return lines.join('\n');
   }

   #inject_or_replace_method(
      code: string,
      class_name: string,
      method_name: string,
      new_method_code: string
   ): string {
      const lines = code.split(/\r?\n/);
      const class_range = this.#find_class_body_range(lines, class_name);

      if (!class_range) {
         return code;
      }

      const escaped_method_name = method_name.replace('$', '\\$');
      const empty_method_regex = new RegExp(`^\\s*(?:public\\s+|private\\s+|protected\\s+)?${escaped_method_name}\\s*\\([^)]*\\)\\s*(?::\\s*[\\w<>, |&]+\\s*)?{\\s*}\\s*$`);

      for (let i = class_range.start_line - 1; i < class_range.end_line; i++) {
         if (
            lines[i]
            && empty_method_regex.test(lines[i]!.trim())
         ) {
            return replace_line_range_in_content(
               code,
               {
                  start_line: i + 1,
                  end_line: i + 1,
                  new_content: new_method_code
               }
            );
         }
      }

      const any_method_regex = new RegExp(`^\\s*(?:public\\s+|private\\s+|protected\\s+)?${escaped_method_name}\\s*\\(`);
      let method_exists = false;

      for (let i = class_range.start_line - 1; i < class_range.end_line; i++) {
         if (
            lines[i]
            && any_method_regex.test(lines[i]!.trim())
         ) {
            method_exists = true;

            break;
         }
      }

      if (!method_exists) {
         const final_lines = code.split(/\r?\n/);
         const final_class_range = this.#find_class_body_range(final_lines, class_name);

         if (final_class_range) {
            final_lines.splice(final_class_range.end_line - 1, 0, `\n${new_method_code}\n`);

            return final_lines.join('\n');
         }
      }

      return code;
   }

   #add_internal_imports_recursively(
      view_name: string
   ) {
      if (!this.current_file_internal_imports) {
         return;
      }

      const visited = new Set<string>();
      const queue = [view_name];

      visited.add(view_name);

      while (queue.length > 0) {
         const current_view = queue.shift()!;

         if (current_view.startsWith('___intr_View_')) {
            this.current_file_internal_imports.add(current_view);
         }

         const view_info = this.registry.generated_internal_views.get(current_view);

         if (view_info?.internal_dependencies) {
            for (const dep of view_info.internal_dependencies) {
               if (!visited.has(dep)) {
                  visited.add(dep);
                  queue.push(dep);
               }
            }
         }
      }
   }

   #has_ancestor_with_constructor(
      class_name: string
   ): boolean {
      let current_meta = this.registry.get_class_metadata(class_name);
      const visited = new Set<string>();

      while (current_meta?.extends_type_names?.[0]) {
         const parent_name = current_meta.extends_type_names[0];

         if (visited.has(parent_name)) {
            return false;
         }

         visited.add(parent_name);

         const parent_meta = this.registry.get_class_metadata(parent_name);

         if (!parent_meta) {
            return true;
         }

         if (parent_meta.has_constructor) {
            return true;
         }

         current_meta = parent_meta;
      }

      return false;
   }
}