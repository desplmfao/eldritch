/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/type-utils/src/guerrero/codegen.ts
 */

import type { SchemaLayout, MetadataClassExtracted, PropertyLayout, UnionVariantMetadata } from '@self/guerrero/index';
import type { TypeNode } from '@self/guerrero/parser';

import type { IBuildTimeRegistry } from '@self/builder/registry';
import type { ITypeResolver } from '@self/builder/resolver';
import type { FileOrigin } from '@self/builder/origin';

export interface IPropertyCodegen {
   /**
    * determines if this generator can handle the given property layout
    *
    * @param strategy for recursive propgen
    * @param property_layout the layout information for the property
    */
   can_handle(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): boolean;

   /**
    * generates the typescript code for the property's getter
    *
    * @param strategy for recursive propgen
    * @param property_layout the layout information for the property
    * @param class_name the name of the parent class being generated
    */
   generate_getter(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string;

   /**
    * generates the typescript code for the property's setter
    *
    * @param strategy for recursive propgen
    * @param property_layout the layout information for the property
    * @param class_name the name of the parent class being generated
    *
    * @returns an empty string if the property is read-only
    */
   generate_setter(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string;

   /**
    * declares the names of types that need to be imported for this property to function
    *
    * @param strategy for recursive propgen
    * @param property_layout the layout information for the property
    */
   get_required_imports(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): Set<string>;

   /**
    * generates any necessary helper classes or functions that should be included at the top of the generated file
    *
    * @param strategy for recursive propgen
    * @param property_layout the layout information for the property
    * @param generated_helpers a set containing the names of helpers already generated in the current file, to prevent duplication
    */
   generate_helpers?(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      generated_helpers: Set<string>
   ): string;

   /**
    * generates the typescript code for a private field used to cache the view for this property
    *
    * @param strategy for recursive propgen
    * @param property_layout the layout information for the property
    *
    * @returns a string containing the private field declaration, or null/empty if not needed
    */
   generate_private_view_field?(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined;

   /**
    * generates the typescript code for a private static field required by this property
    *
    * @param strategy for recursive propgen
    * @param property_layout the layout information for the property
    *
    * @returns a string containing the private static field declaration, or null/empty if not needed
    */
   generate_private_static_field?(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined;

   /**
    * generates a code snippet that contributes to a class-level hash function
    *
    * @param strategy for recursive propgen
    * @param property_layout the layout information for the property
    * @param class_name the name of the parent class being generated
    *
    * @returns a string of code that calculates and combines the hash of this property
    */
   generate_hash_statement?(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string | undefined;

   /**
    * generates a code snippet that contributes to a class-level equality check
    *
    * @param strategy for recursive propgen
    * @param property_layout the layout information for the property
    * @param class_name the name of the parent class being generated
    *
    * @returns a string of code that compares this property against another instance
    */
   generate_equals_statement?(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string | undefined;

   /**
    * generates getter and setter for the raw control block pointer of a dynamic property
    * 
    * this is for advanced, low-level manipulation and data swapping
    *
    * @param strategy for recursive propgen
    * @param property_layout the layout information for the property
    * @param class_name the name of the parent class being generated
    * 
    * @returns a string containing the get/set accessor code for the pointer, or null/empty if not applicable
    */
   generate_pointer_accessors?(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string | undefined;

   /**
    * generates the line of code to free this specific property, if applicable
    *
    * @param strategy for recursive propgen
    * @param property_layout the layout information for the property
    * @param class_name the name of the parent class being generated
    * 
    * @returns a string containing the free statement(s), or nothing if no explicit free is needed for this property type
    */
   generate_free_statement?(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string | undefined;

   /**
    * (for union variants)
    *
    * generates the code for a `case` block within a union getter's switch statement
    *
    * @param strategy for recursive propgen
    * @param variant metadata for a single variant within a union type
    * @param property_layout the layout information for the property
    * @param class_name the name of the parent class being generated
    * 
    * @returns a string containing the union getter case or nothing if there is no unions for the property
    */
   generate_union_getter_case?(
      strategy: ICodegenStrategy,
      variant: UnionVariantMetadata,
      property_layout: PropertyLayout,
      class_name: string
   ): string | undefined;

   /**
    * (for union variants)
    *
    * generates the code for an `if/else if` block within a union setter
    *
    * @param strategy for recursive propgen
    * @param variant metadata for a single variant within a union type
    * @param property_layout the layout information for the property
    * @param class_name the name of the parent class being generated
    * 
    * @returns a string containing the union setter case or nothing if there is no unions for the property
    */
   generate_union_setter_case?(
      strategy: ICodegenStrategy,
      variant: UnionVariantMetadata,
      property_layout: PropertyLayout,
      class_name: string
   ): string | undefined;

   /**
    * (for union variants)
    *
    * generates the code for a `case` block within a union's `free()` method's switch statement
    *
    * @param strategy for recursive propgen
    * @param variant metadata for a single variant within a union type
    * @param property_layout the layout information for the property
    * 
    * @returns a string containing the union setter case or nothing if there is no unions for the property
    */
   generate_union_free_case?(
      strategy: ICodegenStrategy,
      variant: UnionVariantMetadata,
      property_layout: PropertyLayout
   ): string | undefined;

   /**
    * a check similar to can_handle, but for determining if a propgen can create a full, standalone IView class for a given type
    *
    * this is primarily for collection types
    */
   can_handle_as_standalone?(
      type_node: TypeNode
   ): boolean;

   /**
    * generates the code for a self-contained, IView-compliant class that represents the given type_node
    */
   generate_standalone_view_class?(
      strategy: ICodegenStrategy,
      type_node: TypeNode,
      class_name: string
   ): {
      code: string;
      imports: Set<string>;
      schema: SchemaLayout;
      internal_dependencies: Set<string>;
   };
}

export interface ICodegenStrategy {
   readonly generates_iview: boolean;

   propgens: IPropertyCodegen[];

   project_root_path: string;
   guerrero_internal_views_path?: string;
   combined_import_map?: ReadonlyMap<string, string>;

   registry: IBuildTimeRegistry;
   resolver: ITypeResolver;

   alias_cache: Map<string, string>;
   current_file_internal_imports?: Set<string>;
   current_file_origin?: FileOrigin;
   current_file_path?: string;

   file_local_imports: Set<string>;

   /**
    * transforms the source code of a file, replacing guerrero-managed classes with their generated implementations
    *
    * @param source_code the original source code string
    * @param file_path the absolute path to the file being transformed
    * @param layouts a map of class names to their pre-calculated schema layouts
    * @param metadata a map of class names to their extracted metadata
    */
   transform_source_code(
      layouts: ReadonlyMap<string, SchemaLayout>,
      metadata: ReadonlyMap<string, MetadataClassExtracted>,
      source_code: string,
      file_path: string
   ): Promise<{
      code: string;
      imports: Set<string>;
      internal_imports: Set<string>;
   }>;

   /**
    * recursively generates (or retrieves from a cache) a complete IView class and its schema for a given complex type string (e.g., 'u32[]')
    *
    * @param type_string the type to generate a view for
    *
    * @returns the generated class name and its schema
    */
   get_or_generate_view_and_schema_for_type(
      type_string: string
   ): {
      class_name: string;
      schema: SchemaLayout;
   };

   /**
    * retrieves the map of import names to package paths required by this strategy's runtime skeletons
    */
   get_import_map(): ReadonlyMap<string, string>;

   /**
    * generates a consistent, unique alias for a user-defined type when referenced from an internally generated view
    *
    * @param type_name the original name of the user-defined type
    */
   get_alias_for_user_type(type_name: string): string | undefined;

   /**
    * gets the appropriate type name to use in generated code, handling aliases for internal views
    *
    * @param type_name the original name of the type
    */
   get_type_name_for_codegen(type_name: string): string;

   /**
    * constructs a map of user-defined type names to their sanitized aliases for a given type string
    *
    * this is used to generate deterministic, unique names for internal helper views
    *
    * @param type_string the guerrero type string to analyze
    */
   get_user_type_name_map_for_sanitization(
      type_string: string
   ): Map<string, string>;

   /**
    * generates the boilerplate constructor for the IView class
    *
    * @param layout the schema layout for the class being generated
    * @param class_name the name of the class being generated
    *
    * @returns the constructor code string
    */
   generate_constructor_code(
      layout: SchemaLayout,
      class_name: string
   ): string;

   /**
    * generates the body of the method to initialize default values, if any
    *
    * @param layout the schema layout
    * @param class_name the name of the class being generated
    *
    * @returns the method code string, or null if no defaults are present
    */
   generate_initialize_defaults_method_code?(
      layout: SchemaLayout,
      class_name: string
   ): string | undefined;

   /**
    * generates the body of the free method by iterating over properties
    *
    * @param layout the schema layout
    * @param class_name the name of the class being generated
    *
    * @returns the free method code string, or null if no freeing is needed
    */
   generate_free_method_code(
      layout: SchemaLayout,
      class_name: string
   ): string | undefined;

   /**
    * generates the body of the copy_from method
    *
    * @param layout the schema layout
    *
    * @returns the copy_from method code string
    */
   generate_copy_from_method_code(
      layout: SchemaLayout
   ): string;

   /**
    * generates the body of the hash method
    *
    * @param layout the schema layout
    * @param class_name the name of the class being generated
    *
    * @returns the hash method code string, or null if no hashable properties exist
    */
   generate_hash_method_code(
      layout: SchemaLayout,
      class_name: string
   ): string | undefined;

   /**
    * generates the body of the equals method
    *
    * @param layout the schema layout
    * @param class_name the name of the class being generated
    *
    * @returns the equals method code string, or null if no comparable properties exist
    */
   generate_equals_method_code(
      layout: SchemaLayout,
      class_name: string
   ): string | undefined;

   /** */
   generate_default_value_string(
      value: any,
      layout: PropertyLayout
   ): string;
}