/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-logger-namespace/src/transform.ts
 */

import * as swc from '@swc/core';

import { NamespaceVisitor } from '@self/visitor';

import { PLUGIN_NAME } from '@self/constants';

import type { PackageInfo } from '@self/types';

export interface NamespaceTransformOptions {
   /** absolute path to the file being processed */
   absolute_file_path: string;
   /** information about the package the file belongs to */
   package_info: PackageInfo;
   /** Relative path of the file within its package (posix style, no extension) */
   relative_path_in_package: string;
   /** should the namespace be human-readable (debug) or hashed (production)? */
   use_readable_namespace: boolean;
   /** swc parsing options */
   parser_options: swc.ParseOptions;
   /** swc printing options (including source map config) */
   print_options: swc.Options;
   /** enable verbose logging */
   verbose?: boolean;
}

/**
 * applies the namespace injection transformation using swc
 *
 * @param code - the input source code string
 * @param options - configuration options for the transformation
 *
 * @returns the transformed code and the optional source map
 */
export async function apply_namespace_transform(
   code: string,
   options: NamespaceTransformOptions
): Promise<{
   code: string;
   map?: string
}> {
   const { verbose = false } = options;

   if (verbose) {
      console.debug(`[${PLUGIN_NAME}] applying namespace transform to: ${options.absolute_file_path}`);
      console.debug(`[${PLUGIN_NAME}]    package: ${options.package_info.name}, relative path: ${options.relative_path_in_package}`);
   }

   try {
      const ast: swc.Module = await swc.parse(code, options.parser_options);

      const namespace_visitor = new NamespaceVisitor(
         options.absolute_file_path,
         options.package_info,
         options.relative_path_in_package,
         options.use_readable_namespace
      );

      const transformed_ast = namespace_visitor.visitModule(ast);

      const print_result = await swc.print(transformed_ast, options.print_options);

      if (verbose) {
         console.debug(`[${PLUGIN_NAME}] namespace transform applied successfully`);
      }

      return print_result;
   } catch (e) {
      const message = `[${PLUGIN_NAME}] swc error during namespace transform for ${options.absolute_file_path}\n\ncode:\n\`\`\`ts\n${code}\n\`\`\`\n\n`;

      console.error(message, e);
      throw new Error(message, { cause: e });
   }
}