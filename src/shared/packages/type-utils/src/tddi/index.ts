/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/type-utils/src/tddi/index.ts
 */

/** describes a single named import from a module */
export interface ImportSpecifierInfo {
   /** the original name of the export from the source module */
   original_name: string;
   /** the local name (alias) this import is bound to */
   local_name: string;
}

/** describes a default import from a module */
export interface DefaultImportInfo {
   /** the local name the default export is bound to */
   local_name: string;
}

/** describes a namespace import from a module */
export interface NamespaceImportInfo {
   /** the local alias for the entire module namespace */
   local_name: string;
}

/** comprehensively describes a single import declaration in a file */
export interface ImportInfo {
   /** the raw string path from the import statement */
   source_path: string;
   /** the fully resolved absolute path to the imported file or package entry point */
   resolved_path: string | null;
   /** the fully resolved path to the original source `.ts` file */
   resolved_source_path: string | null;

   /** information about the default import, if present */
   default_import?: DefaultImportInfo;
   /** an array of all named imports from this declaration */
   named_imports: ImportSpecifierInfo[];
   /** information about the namespace import, if present */
   namespace_import?: NamespaceImportInfo;
}

/** the final, processed information for a single imported symbol within a file */
export interface ResolvedImport {
   /** the local name used for the import within the file */
   local_name: string;
   /** the original name of the symbol as it was exported from its source module */
   original_name: string;
   /** the absolute path to the TypeScript source file where the symbol is defined */
   source_file_path: string | null;
}

/** describes a named export specifier in a re-export statement */
export interface ExportSpecifierInfo {
   /** the name of the symbol in the source module */
   original_name: string;
   /** the name the symbol is exported as */
   exported_name: string;
}

/** describes a star re-export declaration */
export interface ExportAllInfo {
   /** the raw string path from the export statement */
   source_path: string;
}

/** describes a locally defined and exported symbol */
export interface LocalExportInfo {
   /** the name of the exported symbol */
   name: string;
}

//
//

/** the base interface for all tddi metadata descriptors */
export interface TDDIMetadata {
   /** a string literal identifying the injection type */
   injection_type: string;
   /** the name of the marker type for debugging */
   marker_type_name: string;
}

/** metadata for a resource injection */
export interface ResMetadata extends TDDIMetadata {
   injection_type: 'ecs:inject:resource';
   /** the name of the resource class constructor */
   resource_ctor: string;
   /** whether the resource was requested as readonly */
   is_readonly: boolean;
}

/** metadata for a component in a query */
export interface QueryComponentInfo {
   /** the name of the component class constructor */
   component_ctor: string;
   /** whether the component was requested as readonly */
   is_readonly: boolean;
}

/** metadata for a query filter */
export interface QueryFilterInfo {
   /** the type of filter */
   filter_type: 'With' | 'Without';
   /** an array of component constructor names for the filter */
   component_ctors: string[];
}

/** metadata for an entity query injection */
export interface QueryMetadata extends TDDIMetadata {
   injection_type: 'ecs:inject:query';
   /** an ordered array of components to access */
   components: QueryComponentInfo[];
   /** an array of filter conditions */
   filters: QueryFilterInfo[];
}

/** metadata for the world/commands injection */
export interface CommandsMetadata extends TDDIMetadata {
   injection_type: 'ecs:inject:commands';
}

/** metadata for local state injection */
export interface LocalMetadata extends TDDIMetadata {
   injection_type: 'ecs:inject:local';
   /** the name of the private property on the system class that holds the state */
   property_name: string;
}

/** stores all collected injection metadata for a single method */
export interface MethodTDDIMetadata {
   [parameter_index: number]: TDDIMetadata;
}

/** stores all collected metadata for a single file, mapping class name to method name to metadata */
export interface FileTDDIMetadata {
   [class_name: string]: {
      [method_name: string]: MethodTDDIMetadata;
   };
}