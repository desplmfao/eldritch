/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/utils/src/std/object.ts
 */

import type { ObjK } from '@eldritch-engine/type-utils';

import { SparseSet } from '@self/std/sparse_set';
import { DeepSet } from '@self/std/collections/deep_set';

export function deep_clone<T>(object: T): T {
   if (
      object == null
      || typeof object !== 'object'
   ) {
      return object;
   }

   if (
      'clone' in object
      && typeof object.clone === 'function'
   ) {
      return object.clone();
   }

   if (
      '$clone' in object
      && typeof object.$clone === 'function'
   ) {
      return object.$clone();
   }

   // this is for guerrero native strategy compat - will not work with anything besides them, due to it assuming no constructor signature
   if (
      '$copy_from' in object
      && typeof object.$copy_from === 'function'
      && 'constructor' in object
      && typeof object.constructor === 'function'
   ) {
      const new_instance = new (object.constructor as new () => T)();

      // @ts-expect-error - guaranteed to exist due to the if checks
      new_instance.$copy_from(object);

      return new_instance;
   }

   if (object instanceof Date) {
      return new Date(object.getTime()) as T;
   }

   if (object instanceof RegExp) {
      return new RegExp(object.source, object.flags) as T;
   }

   if (object instanceof Map) {
      const cloned_map = new Map();

      for (const [key, value] of object.entries()) {
         cloned_map.set(deep_clone(key), deep_clone(value));
      }

      return cloned_map as T;
   }

   if (object instanceof DeepSet) {
      const cloned_set = new DeepSet();
      for (const value of object.values()) {
         cloned_set.add(deep_clone(value));
      }
      return cloned_set as T;
   }

   if (object instanceof Set) {
      const cloned_set = new Set();

      for (const value of object.values()) {
         cloned_set.add(deep_clone(value));
      }

      return cloned_set as T;
   }

   if (object instanceof SparseSet) {
      const cloned_set = new SparseSet(object.values());

      return cloned_set as T;
   }

   if (Array.isArray(object)) {
      return object.map(deep_clone) as T;
   }

   const cloned_object = Object.create(Object.getPrototypeOf(object));

   for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
         cloned_object[key] = deep_clone(object[key as keyof T]);
      }
   }

   return cloned_object as T;
}

/**
 * creates a shallow copy of an object or array. nested objects and arrays are
 * copied by reference
 *
 * this is a faster, "lazy" alternative to `deep_clone`
 *
 * @template T - the type of the object
 * @param object - the object or array to clone
 */
export function shallow_clone<T>(object: T): T {
   if (Array.isArray(object)) {
      return [...object] as T;
   }
   if (object !== null && typeof object === 'object') {
      return { ...object } as T;
   }
   return object;
}

export function deep_equal(a: unknown, b: unknown): boolean {
   if (a === b) {
      return true;
   }

   if (
      typeof a !== 'object'
      || a == null
      || typeof b !== 'object'
      || b == null
   ) {
      return false;
   }

   if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
   }

   if (a instanceof RegExp && b instanceof RegExp) {
      return a.source === b.source && a.flags === b.flags;
   }

   if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size) {
         return false;
      }

      for (const [key, value] of a.entries()) {
         let found = false;

         for (const [key_b, value_b] of b.entries()) {
            if (deep_equal(key, key_b)) {
               if (!deep_equal(value, value_b)) {
                  return false;
               }

               found = true;

               break;
            }
         }

         if (!found) {
            return false;
         }
      }

      return true;
   }

   if (a instanceof Set && b instanceof Set) {
      if (a.size !== b.size) {
         return false;
      }

      for (const value_a of a) {
         let found = false;

         for (const value_b of b) {
            if (deep_equal(value_a, value_b)) {
               found = true;

               break;
            }
         }

         if (!found) {
            return false;
         }
      }

      return true;
   }

   if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) {
         return false;
      }

      for (let i = 0; i < a.length; i++) {
         if (!deep_equal(a[i], b[i])) {
            return false;
         }
      }

      return true;
   }

   const keys_a = Object.keys(a);
   const keys_b = Object.keys(b);

   if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) {
      return false;
   }

   if (keys_a.length !== keys_b.length) {
      return false;
   }

   for (const key of keys_a) {
      if (
         !Object.prototype.hasOwnProperty.call(b, key) ||
         !deep_equal(
            (a as Record<ObjK, unknown>)[key],
            (b as Record<ObjK, unknown>)[key]
         )
      ) {
         return false;
      }
   }

   return true;
}

/**
 * performs a fast, heuristic-based "lazy" equality check. it does not
 * recursively check all nested properties, making it much faster but much
 * less thorough than `deep_equal`
 *
 * - for arrays, it checks length and then only compares the first and last elements
 * - for objects, it checks key count and then only compares the values of the first and last keys
 *
 * @param a - the first value to compare
 * @param b - the second value to compare
 */
export function lazy_equal(a: unknown, b: unknown): boolean {
   if (a === b) {
      return true;
   }

   if (
      typeof a !== 'object'
      || a == null
      //
      || typeof b !== 'object'
      || b == null
   ) {
      return false;
   }

   if (
      Array.isArray(a)
      && Array.isArray(b)
   ) {
      if (a.length !== b.length) {
         return false;
      }

      if (a.length === 0) {
         return true;
      }

      return a[0] === b[0]
         && a[a.length - 1] === b[b.length - 1];
   }

   if (
      a.constructor === Object
      && b.constructor === Object
   ) {
      const keys_a = Object.keys(a);
      const keys_b = Object.keys(b);

      if (keys_a.length !== keys_b.length) {
         return false;
      }

      if (keys_a.length === 0) {
         return true;
      }

      const last_key_a = keys_a[keys_a.length - 1]!;
      const last_key_b = keys_b[keys_b.length - 1]!;

      if (
         keys_a[0] !== keys_b[0]
         || last_key_a !== last_key_b
      ) {
         return false;
      }

      const record_a = a as Record<ObjK, unknown>;
      const record_b = b as Record<ObjK, unknown>;

      return record_a[keys_a[0]!] === record_b[keys_b[0]!]
         && record_a[last_key_a] === record_b[last_key_b];
   }

   return false;
}

/**
 * recursively merges properties of source objects into the target object
 *
 * @param target - the object to merge properties into
 * @param sources - the source objects to merge properties from
 */
export function deep_merge<T extends object>(
   target: T,
   ...sources: Partial<T>[]
): T {
   if (!sources.length) {
      return target;
   }

   const source = sources.shift();

   if (source) {
      for (const key in source) {
         if (Object.prototype.hasOwnProperty.call(source, key)) {
            const source_key = key as keyof T;
            if (
               typeof target[source_key] === 'object'
               && target[source_key] !== null
               //
               && typeof source[source_key] === 'object'
               && source[source_key] !== null
               //
               && !Array.isArray(target[source_key])
               && !Array.isArray(source[source_key])
            ) {
               deep_merge(target[source_key] as object, source[source_key] as object);
            } else {
               target[source_key] = source[source_key] as T[keyof T];
            }
         }
      }
   }

   return deep_merge(target, ...sources);
}

/**
 * a function to safely get a nested property from an object using a dot-notation string
 */
export function get_nested_property(obj: Record<ObjK, any>, path: string): any {
   return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}