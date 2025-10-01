/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/type-utils/src/builder/registry.ts
 */

import type { MetadataClassExtracted, SchemaLayout } from '@self/guerrero/index';
import type { ImportInfo } from '@self/tddi';

import type { ITypeResolver } from '@self/builder/resolver';
import type { FileOrigin } from '@self/builder/origin';

/**
 * an interface defining the contract for a build-time registry that provides access to reflection metadata and calculated schema layouts for the entire project
 *
 * this is used by various build tools to resolve types and dependencies without creating circular package dependencies
 */
export interface IBuildTimeRegistry {

   /** */
   resolver: ITypeResolver;

   /** the root path of the project being analyzed */
   readonly project_root_path: string;
   /** */
   readonly source_roots: readonly string[];

   /** */
   readonly import_maps: Map<string, Map<string, ImportInfo>>;
   /** */
   readonly metadata: Map<string, MetadataClassExtracted>;
   /** */
   readonly layouts: Map<string, SchemaLayout>;
   /** */
   readonly aliases: Map<string, string>;
   /** */
   readonly tddi_marker_cache: Map<string, boolean>;
   /** */
   readonly enum_definitions: Map<string, Map<string, number>>;

   /**
    * a map of generated internal view class names to their source code and import dependencies
    *
    * this is populated during the build analysis phase
    */
   readonly generated_internal_views: Map<
      string,
      {
         code: string;
         imports: Set<string>;
         internal_dependencies?: Set<string>;
      }
   >;

   /**
    * analyzes all source files within the configured scope to build a comprehensive, project-wide metadata registry
    *
    * @param options configuration for the analysis pass
    */
   analyze_project(
      options: {
         verbose?: boolean;
         guerrero_internal_views_path?: string;
         scope_to_dirs?: readonly string[];
         files_to_analyze?: readonly string[];
      }
   ): Promise<void>;

   /**
    * retrieves the raw extracted metadata for a given class name
    *
    * @param class_name the name of the class
    *
    * @returns the extracted metadata, or undefined if not found
    */
   get_class_metadata(
      class_name: string
   ): MetadataClassExtracted | undefined;

   /**
    * retrieves a pre-calculated or on-demand calculated schema layout for a given type name
    *
    * @param type_name the name of the user-defined type
    *
    * @returns the schema layout
    */
   get_schema_layout(
      type_name: string
   ): SchemaLayout | undefined;

   /**
    * registers a type alias
    *
    * @param alias_name the name of the alias
    * @param target_type_string the type string the alias expands to
    */
   register_type_alias(
      alias_name: string,
      target_type_string: string
   ): void;

   /**
    * retrieves the target type string for a given alias name
    *
    * @param alias_name the name of the alias
    *
    * @returns the target type string
    */
   get_type_alias_target(
      alias_name: string
   ): string | undefined;

   /**
    * checks if a given type is a tddi marker type by analyzing its source ast
    *
    * @param type_name the local name of the type to check
    * @param import_info the import information for this type
    * @param underlying_name the name of the special property that identifies a marker type
    */
   is_tddi_marker(
      type_name: string,
      import_info: ImportInfo,
      underlying_name: string
   ): Promise<boolean>;

   /**
    * retrieves the origin category of a file path
    *
    * @param file_path the absolute, normalized path of the file
    *
    * @returns the file's origin, or undefined if the file was not part of the analysis
    */
   get_file_origin(
      file_path: string
   ): FileOrigin | undefined;

   /**
    * retrieves the origin category of a type by its name
    *
    * @param type_name the name of the class or enum
    *
    * @returns the type's origin, or undefined if the type was not found in the metadata
    */
   get_type_origin(
      type_name: string
   ): FileOrigin | undefined;
}