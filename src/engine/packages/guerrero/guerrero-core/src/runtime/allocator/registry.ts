/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/src/runtime/allocator/registry.ts
 */

import type { IView, IViewConstructor, Pointer } from '@eldritch-engine/type-utils/guerrero/index';

import type { AllocationNode } from '@self/runtime/allocator/types';

/**
 * a debug-only registry that maps allocation pointers to the IViewConstructor that "owns" them
 *
 * it builds a hierarchical tree of allocations to enable visualization and debugging of memory ownership
 *
 * this entire class and its usage should be stripped from release builds
 */
export class AllocationRegistry {
   /** a map of all allocation pointers to their corresponding tree node */
   readonly nodes: Map<Pointer, AllocationNode> = new Map();
   /** a set of pointers that are the roots of allocation trees */
   readonly roots: Set<Pointer> = new Set();

   /**
    * registers a new allocation, creating a node for it in the tree
    *
    * @param ptr - the user pointer of the new allocation
    * @param owner - the constructor of the `IView` that owns this allocation
    * @param parent_ptr - the pointer of the parent allocation, or `null` if this is a root
    */
   register(
      ptr: Pointer,
      owner: IViewConstructor<IView>,
      parent_ptr?: Pointer
   ): void {
      if (this.nodes.has(ptr)) {
         this.unregister(ptr);
      }

      const node: AllocationNode = {
         ptr,
         owner,
         parent_ptr,
         children: new Set(),
      };

      this.nodes.set(ptr, node);

      if (parent_ptr) {
         const parent_node = this.nodes.get(parent_ptr);

         if (parent_node) {
            parent_node.children.add(ptr);
         } else {
            this.roots.add(ptr);
         }
      } else {
         this.roots.add(ptr);
      }
   }

   /**
    * unregisters an allocation upon being freed, removing it from the tree
    *
    * its children are re-parented to its parent, or become roots
    *
    * @param ptr - the user pointer of the allocation to unregister
    */
   unregister(
      ptr: Pointer
   ): void {
      const node_to_delete = this.nodes.get(ptr);

      if (!node_to_delete) {
         return;
      }

      if (node_to_delete.parent_ptr) {
         const parent_node = this.nodes.get(node_to_delete.parent_ptr);

         parent_node?.children.delete(ptr);
      }

      const new_parent_ptr = node_to_delete.parent_ptr;

      for (const child_ptr of node_to_delete.children) {
         const child_node = this.nodes.get(child_ptr);

         if (child_node) {
            child_node.parent_ptr = new_parent_ptr;

            if (new_parent_ptr) {
               this.nodes.get(new_parent_ptr)?.children.add(child_ptr);
            } else {
               this.roots.add(child_ptr);
            }
         }
      }

      this.nodes.delete(ptr);
      this.roots.delete(ptr);
   }

   /**
    * retrieves the node for a given allocation pointer
    *
    * @param ptr - the user pointer of the allocation
    */
   get_node(
      ptr: Pointer
   ): AllocationNode | undefined {
      return this.nodes.get(ptr);
   }

   /**
    * Retrieves the owner constructor for a given allocation pointer
    *
    * @deprecated use `get_node` instead to access full node information
    */
   get_owner(
      user_ptr: Pointer
   ): IViewConstructor<IView> | undefined {
      return this.nodes.get(user_ptr)?.owner;
   }

   /**
    * returns a readonly view of the internal map for inspection purposes
    *
    * @deprecated use `get_node` and `get_root_pointers` for actual tree traversal
    */
   get_all_allocations(): ReadonlyMap<Pointer, IViewConstructor<IView>> {
      const flat_map = new Map<Pointer, IViewConstructor<IView>>();

      for (const [ptr, node] of this.nodes) {
         flat_map.set(ptr, node.owner);
      }

      return flat_map;
   }

   /** returns a set of all root allocation pointers */
   get_root_pointers(): ReadonlySet<Pointer> {
      return this.roots;
   }

   /** clears all registrations from the registry */
   clear(): void {
      this.nodes.clear();
      this.roots.clear();
   }
}