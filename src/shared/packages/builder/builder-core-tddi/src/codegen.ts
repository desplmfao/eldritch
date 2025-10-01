/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-tddi/src/codegen.ts
 */

import { default as path } from 'node:path';

import type { FileTDDIMetadata, ImportInfo, QueryMetadata, ResMetadata, TDDIMetadata } from '@eldritch-engine/type-utils/tddi/index';

function get_relative_import_path(
   from_file: string,
   to_file: string
): string {
   let relative = path.relative(path.dirname(from_file), to_file);

   if (!relative.startsWith('.')) {
      relative = './' + relative;
   }

   return relative.replace(/\.ts$/, '');
}

export function generate_injection_object_code(
   injection: TDDIMetadata
): string {
   const parts: string[] = [
      `injection_type: '${injection.injection_type}'`
   ];

   if (injection.injection_type === 'ecs:inject:resource') {
      const meta = injection as ResMetadata;

      parts.push(`resource_ctor: ${meta.resource_ctor}`);
   } else if (injection.injection_type === 'ecs:inject:query') {
      const meta = injection as QueryMetadata;

      const components_str = meta.components.map(c => c.component_ctor).join(', ');
      const with_str = meta.filters.find(f => f.filter_type === 'With')?.component_ctors.join(', ');
      const without_str = meta.filters.find(f => f.filter_type === 'Without')?.component_ctors.join(', ');

      parts.push(`components: [${components_str}]`);

      let options_parts: string[] = [];

      if (with_str) {
         options_parts.push(`with: [${with_str}]`);
      }

      if (without_str) {
         options_parts.push(`without: [${without_str}]`);
      }

      if (options_parts.length > 0) {
         parts.push(`options: { ${options_parts.join(', ')} }`);
      } else {
         parts.push(`options: {}`);
      }
   }

   return `{ ${parts.join(', ')} }`;
}

// TODO: figure out how to have these without duping the fuck out of names and code lmao
export function generate_tddi_code(
   file_path: string,
   file_metadata: FileTDDIMetadata,
   import_map: Map<string, ImportInfo>
): string {
   const imports_to_add: Map<string, Set<string>> = new Map();

   const add_import = (
      name: string,
      source_info?: ImportInfo
   ) => {
      if (
         !source_info ||
         !source_info.resolved_source_path
      ) {
         return;
      }

      const import_path = source_info.source_path.startsWith('.')
         ? get_relative_import_path(file_path, source_info.resolved_source_path)
         : source_info.source_path;

      if (!imports_to_add.has(import_path)) {
         imports_to_add.set(import_path, new Set());
      }

      imports_to_add.get(import_path)!.add(name);
   };

   let all_generated_calls = '';
   const is_in_reflect = file_path.includes('/reflect/');

   for (const class_name in file_metadata) {
      add_import(class_name, import_map.get(class_name));

      for (const method_name in file_metadata[class_name]) {
         const method_metadata = file_metadata[class_name]![method_name]!;
         const injection_map_entries: string[] = [];

         all_generated_calls += `define_metadata('eldritch:is_di_target', true, ${class_name}.prototype, '${method_name}');\n`;

         for (const param_index in method_metadata) {
            const injection = method_metadata[param_index]!;

            if ('resource_ctor' in injection) {
               add_import((injection as ResMetadata).resource_ctor, import_map.get((injection as ResMetadata).resource_ctor));
            } else if ('components' in injection) {
               const query_meta = injection as QueryMetadata;

               for (const component of query_meta.components) {
                  const name = component.component_ctor;

                  add_import(name, import_map.get(name));
               }

               for (const filter of query_meta.filters) {
                  for (const name of filter.component_ctors) {
                     add_import(name, import_map.get(name));
                  }
               }
            }

            const injection_object_code = generate_injection_object_code(injection);
            injection_map_entries.push(`[${param_index}, ${injection_object_code}]`);
         }

         if (injection_map_entries.length > 0) {
            all_generated_calls += `define_all_injection_metadata(${class_name}.prototype, '${method_name}', new Map([${injection_map_entries.join(', ')}]));\n`;
         }
      }
   }

   if (all_generated_calls.length === 0) {
      return '';
   }

   let code = '\n';

   if (is_in_reflect) {
      code += `import { define_metadata, define_all_injection_metadata } from '@self/index';\n`;
   } else {
      code += `import { define_metadata, define_all_injection_metadata } from '@eldritch-engine/reflect/index';\n`;
   }

   for (const [import_path, names] of imports_to_add) {
      code += `import { ${[...names].join(', ')} } from '${import_path}';\n`;
   }

   code += `\n${all_generated_calls}\n`;

   return code;
}