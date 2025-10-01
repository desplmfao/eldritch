/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/type-utils/src/guerrero/inspector.ts
 */

import type { Pointer, SchemaLayout } from '@self/guerrero/index';

/**
 * a structured, hierarchical representation of a region of memory, interpreted according to a guerrero schema
 *
 * this is a ui-agnostic data model that can be used to build various debugging frontends
 */
export interface InspectedNode {
   /** the property name of this node within its parent, or the root class name */
   name: string;
   /** the guerrero type string for this node (e.g., "u32", "str", "MyStruct") */
   type: string;
   /** the memory offset of this node's data from the start of the buffer */
   offset: Pointer;
   /** the size of this node's data in bytes */
   size: number;
   /** the interpreted primitive value, or a representation of a pointer (e.g., "pointer @0x2b0f8") */
   value: any;
   /** child nodes for structs, collections, and other composite types */
   children?: InspectedNode[];
   /** if present, indicates the total number of children, and that the `children` array is a paginated subset */
   total_children_count?: number;
}

/**
 * options for configuring an inspection operation, such as for pagination
 */
export interface InspectionOptions {
   /** defines a slice of a collection's children to inspect */
   pagination?: {
      /** the starting index of the slice */
      start_index: number;
      /** the number of items to include in the slice */
      count: number;
   };
}

/**
 * defines the contract for a schema-aware memory inspector
 *
 * different implementations of this interface will exist for different memory layout strategies (e.g., aos vs. soa)
 */
export interface IViewInspector<Allocator = unknown> {
   /**
    * inspects a region of a buffer and returns a structured, hierarchical representation of the data
    *
    * @param buffer the `ArrayBufferLike` to inspect
    * @param pointer the starting offset within the buffer
    * @param schema the `SchemaLayout` describing the data at the pointer
    * @param allocator an optional allocator instance, required for inspecting dynamic data
    * @param options optional parameters, such as for pagination
    *
    * @returns a tree-like `InspectedNode` representing the data
    */
   inspect(
      buffer: ArrayBufferLike,
      pointer: Pointer,
      schema: SchemaLayout,
      allocator?: Allocator,
      options?: InspectionOptions
   ): InspectedNode;

   /**
    * automatically discovers and inspects all root allocations in a `TlsfAllocator`
    *
    * this provides a complete snapshot of the allocator's current state
    *
    * @param allocator the allocator instance to inspect
    *
    * @returns an array of `InspectedNode` trees, one for each root allocation
    */
   inspect_all_allocations(
      allocator: Allocator
   ): InspectedNode[];
}