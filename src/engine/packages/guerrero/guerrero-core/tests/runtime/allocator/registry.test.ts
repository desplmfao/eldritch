/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/tests/runtime/allocator/registry.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import type { IView, Pointer, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';

import { AllocationRegistry } from '@self/runtime/allocator/registry';

//
//

class MockOwnerA implements IView {
   static readonly __schema: SchemaLayout = { class_name: MockOwnerA.name, total_size: 0, alignment: 1, has_dynamic_data: false, properties: [] };

   readonly __view!: DataView;
   readonly __buffer!: ArrayBufferLike;
   readonly __byte_offset!: Pointer;
   readonly __allocator: any;
}

class MockOwnerB implements IView {
   static readonly __schema: SchemaLayout = { class_name: MockOwnerB.name, total_size: 0, alignment: 1, has_dynamic_data: false, properties: [] };

   readonly __view!: DataView;
   readonly __buffer!: ArrayBufferLike;
   readonly __byte_offset!: Pointer;
   readonly __allocator: any;
}

class MockOwnerC implements IView {
   static readonly __schema: SchemaLayout = { class_name: MockOwnerC.name, total_size: 0, alignment: 1, has_dynamic_data: false, properties: [] };

   readonly __view!: DataView;
   readonly __buffer!: ArrayBufferLike;
   readonly __byte_offset!: Pointer;
   readonly __allocator: any;
}

//
//

describe('AllocationRegistry', () => {
   let registry: AllocationRegistry;

   beforeEach(() => {
      registry = new AllocationRegistry();
   });

   describe('register', () => {
      it('should register a root allocation', () => {
         const ptr: Pointer = 100;

         registry.register(ptr, MockOwnerA);

         const node = registry.get_node(ptr);
         expect(node).toBeDefined();
         expect(node?.owner).toBe(MockOwnerA);
         expect(node?.parent_ptr).toBeUndefined();
         expect(node?.children.size).toBe(0);

         expect(registry.get_root_pointers()).toContain(ptr);
         expect(registry.get_root_pointers().size).toBe(1);
      });

      it('should register a child allocation', () => {
         const parent_ptr: Pointer = 100;
         const child_ptr: Pointer = 200;

         registry.register(parent_ptr, MockOwnerA);
         registry.register(child_ptr, MockOwnerB, parent_ptr);

         const child_node = registry.get_node(child_ptr);
         expect(child_node).toBeDefined();
         expect(child_node?.owner).toBe(MockOwnerB);
         expect(child_node?.parent_ptr).toBe(parent_ptr);

         const parent_node = registry.get_node(parent_ptr);
         expect(parent_node?.children).toContain(child_ptr);

         expect(registry.get_root_pointers()).not.toContain(child_ptr);
         expect(registry.get_root_pointers().size).toBe(1);
      });

      it('should register a node as a root if its parent does not exist', () => {
         const ptr: Pointer = 300;
         const non_existent_parent_ptr: Pointer = 999;

         registry.register(ptr, MockOwnerC, non_existent_parent_ptr);

         const node = registry.get_node(ptr);
         expect(node).toBeDefined();
         expect(node?.parent_ptr).toBe(non_existent_parent_ptr);
         expect(registry.get_root_pointers()).toContain(ptr);
      });

      it('should correctly re-register an existing pointer, unregistering it first', () => {
         const ptr: Pointer = 100;
         const new_parent_ptr: Pointer = 50;

         registry.register(ptr, MockOwnerA);
         expect(registry.get_root_pointers()).toContain(ptr);

         registry.register(new_parent_ptr, MockOwnerB);
         registry.register(ptr, MockOwnerC, new_parent_ptr);

         const node = registry.get_node(ptr);
         expect(node?.owner).toBe(MockOwnerC);
         expect(node?.parent_ptr).toBe(new_parent_ptr);

         expect(registry.get_root_pointers()).not.toContain(ptr);
         expect(registry.get_root_pointers()).toContain(new_parent_ptr);

         const parent_node = registry.get_node(new_parent_ptr);
         expect(parent_node?.children).toContain(ptr);
      });
   });

   describe('unregister', () => {
      it('should unregister a leaf node', () => {
         registry.register(100, MockOwnerA);
         registry.register(200, MockOwnerB, 100);

         registry.unregister(200);

         expect(registry.get_node(200)).toBeUndefined();
         const parent_node = registry.get_node(100);
         expect(parent_node?.children).not.toContain(200);
      });

      it('should re-parent children when a middle node is unregistered', () => {
         registry.register(100, MockOwnerA);
         registry.register(200, MockOwnerB, 100);
         registry.register(300, MockOwnerC, 200);

         registry.unregister(200);

         expect(registry.get_node(200)).toBeUndefined();
         const child_node = registry.get_node(300);
         expect(child_node?.parent_ptr).toBe(100);

         const parent_node = registry.get_node(100);
         expect(parent_node?.children).not.toContain(200);
         expect(parent_node?.children).toContain(300);
      });

      it('should promote children to roots when a root node is unregistered', () => {
         registry.register(100, MockOwnerA);
         registry.register(200, MockOwnerB, 100);
         registry.register(300, MockOwnerC, 100);

         registry.unregister(100);

         expect(registry.get_node(100)).toBeUndefined();
         expect(registry.get_root_pointers()).not.toContain(100);

         expect(registry.get_node(200)?.parent_ptr).toBeUndefined();
         expect(registry.get_node(300)?.parent_ptr).toBeUndefined();

         expect(registry.get_root_pointers()).toContain(200);
         expect(registry.get_root_pointers()).toContain(300);
         expect(registry.get_root_pointers().size).toBe(2);
      });

      it('should handle unregistering a non-existent pointer gracefully', () => {
         registry.register(100, MockOwnerA);
         const initial_size = registry.nodes.size;

         registry.unregister(999);
         expect(registry.nodes.size).toBe(initial_size);
      });
   });

   describe('getters', () => {
      beforeEach(() => {
         registry.register(100, MockOwnerA);
         registry.register(200, MockOwnerB, 100);
      });

      it('get_node should return the correct node', () => {
         const node = registry.get_node(100);
         expect(node).toBeDefined();
         expect(node?.owner).toBe(MockOwnerA);
      });

      it('get_owner should return the correct owner constructor', () => {
         const owner = registry.get_owner(200);
         expect(owner).toBe(MockOwnerB);
      });

      it('get_all_allocations should return a flat map of pointers to owners', () => {
         const all_allocs = registry.get_all_allocations();
         expect(all_allocs.size).toBe(2);
         expect(all_allocs.get(100)).toBe(MockOwnerA);
         expect(all_allocs.get(200)).toBe(MockOwnerB);
      });

      it('get_root_pointers should return only the root pointers', () => {
         const roots = registry.get_root_pointers();
         expect(roots.size).toBe(1);
         expect(roots).toContain(100);
      });
   });

   describe('clear', () => {
      it('should clear all nodes and roots from the registry', () => {
         registry.register(100, MockOwnerA);
         registry.register(200, MockOwnerB, 100);

         expect(registry.nodes.size).toBe(2);
         expect(registry.roots.size).toBe(1);

         registry.clear();

         expect(registry.nodes.size).toBe(0);
         expect(registry.roots.size).toBe(0);
      });
   });
});