/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/tests/runtime/allocator/allocator_registry.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import type { IView, Pointer, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';

import { AllocationRegistry } from '@self/runtime/allocator/registry';
import { TlsfAllocator } from '@self/runtime/allocator/allocator';
import { GLOBAL_NULL_POINTER } from '@self/runtime/allocator/constants';

//
//

class RootOwner implements IView {
   static readonly __schema: SchemaLayout = {
      class_name: RootOwner.name,
      total_size: 16,
      alignment: 4,
      has_dynamic_data: false,
      properties: []
   };

   readonly __view!: DataView;
   readonly __buffer!: ArrayBufferLike;
   readonly __byte_offset!: Pointer;
   readonly __allocator?: TlsfAllocator;
}

class ChildOwner implements IView {
   static readonly __schema: SchemaLayout = {
      class_name: ChildOwner.name,
      total_size: 8,
      alignment: 4,
      has_dynamic_data: false,
      properties: []
   };

   readonly __view!: DataView;
   readonly __buffer!: ArrayBufferLike;
   readonly __byte_offset!: Pointer;
   readonly __allocator?: TlsfAllocator;
}

class GrandchildOwner implements IView {
   static readonly __schema: SchemaLayout = {
      class_name: GrandchildOwner.name,
      total_size: 4,
      alignment: 4,
      has_dynamic_data: false,
      properties: []
   };

   readonly __view!: DataView;
   readonly __buffer!: ArrayBufferLike;
   readonly __byte_offset!: Pointer;
   readonly __allocator?: TlsfAllocator;
}

//
//

/// #if SAFETY
describe('TlsfAllocator and AllocationRegistry integration', () => {
   let registry: AllocationRegistry;
   let allocator: TlsfAllocator;

   beforeEach(() => {
      registry = new AllocationRegistry();
      const pool_buffer = new ArrayBuffer(1024 * 16);
      allocator = new TlsfAllocator(pool_buffer, 0, undefined, registry);
   });

   it('should correctly register a simple parent-child relationship on allocation', () => {
      const root_ptr = allocator.allocate(16, RootOwner);
      expect(root_ptr).not.toBe(GLOBAL_NULL_POINTER);

      const child_ptr = allocator.allocate(8, ChildOwner, root_ptr);
      expect(child_ptr).not.toBe(GLOBAL_NULL_POINTER);

      const root_node = registry.get_node(root_ptr);
      const child_node = registry.get_node(child_ptr);

      expect(root_node).toBeDefined();
      expect(root_node?.parent_ptr).toBeUndefined();
      expect(root_node?.children.has(child_ptr)).toBe(true);
      expect(registry.get_root_pointers()).toContain(root_ptr);

      expect(child_node).toBeDefined();
      expect(child_node?.parent_ptr).toBe(root_ptr);
      expect(registry.get_root_pointers()).not.toContain(child_ptr);
   });

   it('should correctly handle freeing a child node', () => {
      const root_ptr = allocator.allocate(16, RootOwner);
      const child_ptr = allocator.allocate(8, ChildOwner, root_ptr);

      allocator.free(child_ptr);

      expect(registry.get_node(child_ptr)).toBeUndefined();
      const root_node = registry.get_node(root_ptr);
      expect(root_node?.children.has(child_ptr)).toBe(false);
   });

   it('should correctly re-parent children when a middle node is freed', () => {
      const root_ptr = allocator.allocate(32, RootOwner);
      const child_ptr = allocator.allocate(16, ChildOwner, root_ptr);
      const grandchild_ptr = allocator.allocate(8, GrandchildOwner, child_ptr);

      allocator.free(child_ptr);

      expect(registry.get_node(child_ptr)).toBeUndefined();

      const grandchild_node = registry.get_node(grandchild_ptr);
      expect(grandchild_node?.parent_ptr).toBe(root_ptr);

      const root_node = registry.get_node(root_ptr);
      expect(root_node?.children.has(child_ptr)).toBe(false);
      expect(root_node?.children.has(grandchild_ptr)).toBe(true);
   });

   it('should promote children to roots when a root node is freed', () => {
      const root_ptr = allocator.allocate(32, RootOwner);
      const child1_ptr = allocator.allocate(16, ChildOwner, root_ptr);
      const child2_ptr = allocator.allocate(16, ChildOwner, root_ptr);

      allocator.free(root_ptr);

      expect(registry.get_node(root_ptr)).toBeUndefined();
      expect(registry.get_root_pointers()).not.toContain(root_ptr);

      expect(registry.get_node(child1_ptr)?.parent_ptr).toBeUndefined();
      expect(registry.get_node(child2_ptr)?.parent_ptr).toBeUndefined();

      expect(registry.get_root_pointers()).toContain(child1_ptr);
      expect(registry.get_root_pointers()).toContain(child2_ptr);
   });

   it('should update registry correctly on reallocation (move)', () => {
      const root_ptr = allocator.allocate(32, RootOwner);
      const child_to_realloc_ptr = allocator.allocate(16, ChildOwner, root_ptr);
      const grandchild_ptr = allocator.allocate(8, GrandchildOwner, child_to_realloc_ptr);
      const obstacle_ptr = allocator.allocate(128, RootOwner);

      const reallocated_child_ptr = allocator.reallocate(child_to_realloc_ptr, 64, ChildOwner, root_ptr);

      expect(reallocated_child_ptr).not.toBe(child_to_realloc_ptr);
      expect(reallocated_child_ptr).not.toBe(GLOBAL_NULL_POINTER);

      expect(registry.get_node(child_to_realloc_ptr)).toBeUndefined();

      const reallocated_node = registry.get_node(reallocated_child_ptr);
      expect(reallocated_node).toBeDefined();
      expect(reallocated_node?.owner).toBe(ChildOwner);
      expect(reallocated_node?.parent_ptr).toBe(root_ptr);

      const grandchild_node = registry.get_node(grandchild_ptr);
      expect(grandchild_node?.parent_ptr).toBe(reallocated_child_ptr);
      expect(reallocated_node?.children.has(grandchild_ptr)).toBe(true);

      const root_node = registry.get_node(root_ptr);
      expect(root_node?.children.has(reallocated_child_ptr)).toBe(true);
      expect(root_node?.children.has(child_to_realloc_ptr)).toBe(false);
   });

   it('should maintain registry consistency during in-place reallocation (grow/shrink)', () => {
      const root_ptr = allocator.allocate(32, RootOwner);
      const child_to_realloc_ptr = allocator.allocate(64, ChildOwner, root_ptr);
      const grandchild_ptr = allocator.allocate(8, GrandchildOwner, child_to_realloc_ptr);

      const shrunk_child_ptr = allocator.reallocate(child_to_realloc_ptr, 32);
      expect(shrunk_child_ptr).toBe(child_to_realloc_ptr);

      const shrunk_node = registry.get_node(shrunk_child_ptr);
      expect(shrunk_node).toBeDefined();
      expect(shrunk_node?.parent_ptr).toBe(root_ptr);
      expect(shrunk_node?.children.has(grandchild_ptr)).toBe(true);
      expect(registry.get_node(grandchild_ptr)?.parent_ptr).toBe(shrunk_child_ptr);

      const grown_child_ptr = allocator.reallocate(shrunk_child_ptr, 48);
      expect(grown_child_ptr).toBe(shrunk_child_ptr);

      const grown_node = registry.get_node(grown_child_ptr);
      expect(grown_node).toBeDefined();
      expect(grown_node?.parent_ptr).toBe(root_ptr);
      expect(grown_node?.children.has(grandchild_ptr)).toBe(true);
      expect(registry.get_node(grandchild_ptr)?.parent_ptr).toBe(grown_child_ptr);
   });

   it('should handle reallocation of a root node (move)', () => {
      const root_ptr = allocator.allocate(16, RootOwner);
      const child_ptr = allocator.allocate(8, ChildOwner, root_ptr);
      const obstacle_ptr = allocator.allocate(128, RootOwner);

      const new_root_ptr = allocator.reallocate(root_ptr, 64);
      expect(new_root_ptr).not.toBe(root_ptr);
      expect(new_root_ptr).not.toBe(GLOBAL_NULL_POINTER);

      expect(registry.get_node(root_ptr)).toBeUndefined();
      expect(registry.get_root_pointers()).not.toContain(root_ptr);

      const new_root_node = registry.get_node(new_root_ptr);
      expect(new_root_node).toBeDefined();
      expect(new_root_node?.parent_ptr).toBeUndefined();
      expect(registry.get_root_pointers()).toContain(new_root_ptr);

      const child_node = registry.get_node(child_ptr);
      expect(child_node?.parent_ptr).toBe(new_root_ptr);
      expect(new_root_node?.children.has(child_ptr)).toBe(true);
   });
});
/// #endif