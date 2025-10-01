/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/reflect/src/index.ts
 */

/**
 * the storage for all metadata
 *
 * the data structure is a WeakMap where:
 * - key: the target object (class constructor, prototype, etc)
 * - value: a map where:
 *   - key: a property key (string or symbol), or `undefined` for class-level metadata
 *   - value: a map where:
 *     - key: the user-defined metadata key
 *     - value: the user-defined metadata value
 * @internal
 */
export const METADATA_STORAGE = new WeakMap<object, Map<PropertyKey | undefined, Map<any, any>>>();

/**
 * an internal helper to retrieve (and optionally create) the innermost map where metadata for a specific `target` and `property_key` is stored
 *
 * @param target the object or prototype
 * @param property_key the property key, or `undefined` for class-level metadata
 * @param create if `true`, creates the nested map structure if it doesn't exist
 * 
 * @returns the metadata map, or `undefined` if `create` is false and the map doesn't exist
 */
export function get_metadata_map(
   target: object,
   property_key: PropertyKey | undefined,
   create: boolean
): Map<any, any> | undefined {
   let target_map = METADATA_STORAGE.get(target);

   if (!target_map) {
      if (!create) {
         return;
      }

      target_map = new Map();

      METADATA_STORAGE.set(target, target_map);
   }

   let property_map = target_map.get(property_key);

   if (!property_map) {
      if (!create) {
         return;
      }

      property_map = new Map();
      target_map.set(property_key, property_map);
   }

   return property_map;
}

/**
 * an internal helper to safely get the prototype of a target
 */
export function get_prototype(target: object): object | null {
   if (
      typeof target !== 'object'
      || target == null
   ) {
      return null;
   }

   return Object.getPrototypeOf(target);
}

/**
 * an internal helper to validate that the target is a valid object for attaching metadata
 */
export function validate_target(target: any): asserts target is object {
   if (
      (
         typeof target !== 'object'
         && typeof target !== 'function'
      )
      || target == null
   ) {
      throw new TypeError('metadata target must be an object or a function');
   }
}

//
//

/**
 * associates metadata with a target object or its property
 *
 * @param metadata_key the key for the metadata
 * @param metadata_value the value of the metadata
 * @param target the target object
 * @param property_key optional property key on the target
 */
export function define_metadata(
   metadata_key: any,
   metadata_value: any,
   target: object,
   property_key?: PropertyKey
): void {
   validate_target(target);

   const metadata_map = get_metadata_map(target, property_key, true)!;
   metadata_map.set(metadata_key, metadata_value);
}

/**
 * checks for the presence of a metadata key on the target object or its property, without checking the prototype chain
 *
 * @param metadata_key the key for the metadata
 * @param target the target object
 * @param property_key optional property key on the target
 * @returns `true` if the metadata key is defined on the target
 */
export function has_own_metadata(
   metadata_key: any,
   target: object,
   property_key?: PropertyKey
): boolean {
   validate_target(target);

   const metadata_map = get_metadata_map(target, property_key, false);

   return metadata_map?.has(metadata_key) ?? false;
}

/**
 * checks for the presence of a metadata key on the target object or its property, traversing the prototype chain
 *
 * @param metadata_key the key for the metadata
 * @param target the target object
 * @param property_key optional property key on the target
 * @returns `true` if the metadata key is found anywhere on the prototype chain
 */
export function has_metadata(
   metadata_key: any,
   target: object,
   property_key?: PropertyKey
): boolean {
   validate_target(target);

   let current_target: object | null = target;

   while (current_target) {
      if (has_own_metadata(metadata_key, current_target, property_key)) {
         return true;
      }

      current_target = get_prototype(current_target);
   }

   return false;
}

/**
 * gets the metadata value for a metadata key on the target object or its property, without checking the prototype chain
 *
 * @param metadata_key the key for the metadata
 * @param target the target object
 * @param property_key optional property key on the target
 *
 * @returns the metadata value if found
 */
export function get_own_metadata(
   metadata_key: any,
   target: object,
   property_key?: PropertyKey
): any {
   validate_target(target);

   const metadata_map = get_metadata_map(target, property_key, false);

   return metadata_map?.get(metadata_key);
}

/**
 * gets the metadata value for a metadata key on the target object or its property, traversing the prototype chain
 *
 * @param metadata_key the key for the metadata
 * @param target the target object
 * @param property_key optional property key on the target
 *
 * @returns the metadata value if found
 */
export function get_metadata(
   metadata_key: any,
   target: object,
   property_key?: PropertyKey
): any {
   validate_target(target);

   let current_target: object | null = target;

   while (current_target) {
      const metadata = get_own_metadata(metadata_key, current_target, property_key);

      if (metadata != null) {
         return metadata;
      }

      current_target = get_prototype(current_target);
   }

   return;
}

/**
 * gets all metadata keys defined on the target object or its property, without checking the prototype chain
 *
 * @param target the target object
 * @param property_key optional property key on the target
 * @returns an array of metadata keys
 */
export function get_own_metadata_keys(
   target: object,
   property_key?: PropertyKey
): any[] {
   validate_target(target);

   const metadata_map = get_metadata_map(target, property_key, false);

   return metadata_map ? [...metadata_map.keys()] : [];
}

/**
 * gets all unique metadata keys defined on the target object or its property, traversing the prototype chain
 *
 * @param target the target object
 * @param property_key optional property key on the target
 * @returns an array of unique metadata keys
 */
export function get_metadata_keys(
   target: object,
   property_key?: PropertyKey
): any[] {
   validate_target(target);

   const keys = new Set<any>();
   let current_target: object | null = target;

   while (current_target) {
      const own_keys = get_own_metadata_keys(current_target, property_key);

      for (const key of own_keys) {
         keys.add(key);
      }

      current_target = get_prototype(current_target);
   }

   return [...keys];
}

/**
 * deletes a metadata entry from a target object or its property
 *
 * @param metadata_key the key for the metadata
 * @param target the target object
 * @param property_key optional property key on the target
 * @returns `true` if the metadata was successfully deleted
 */
export function delete_metadata(
   metadata_key: any,
   target: object,
   property_key?: PropertyKey
): boolean {
   validate_target(target);

   const metadata_map = get_metadata_map(target, property_key, false);

   if (!metadata_map) {
      return false;
   }

   return metadata_map.delete(metadata_key);
}

/**
 * appends a value to a metadata entry, creating or converting to an array if necessary
 * useful for accumulating metadata, like multiple validators or middleware on a single target
 *
 * @param metadata_key the key for the metadata
 * @param metadata_value the value to append
 * @param target the target object
 * @param property_key optional property key on the target
 */
export function append_metadata(
   metadata_key: any,
   metadata_value: any,
   target: object,
   property_key?: PropertyKey
): void {
   validate_target(target);

   const existing = get_own_metadata(metadata_key, target, property_key);
   let new_value: any[];

   if (existing == null) {
      new_value = [metadata_value];
   } else if (Array.isArray(existing)) {
      new_value = [...existing, metadata_value];
   } else {
      new_value = [existing, metadata_value];
   }

   define_metadata(metadata_key, new_value, target, property_key);
}

/**
 * gets all metadata key-value pairs defined on the target object or its property, without checking the prototype chain
 *
 * @param target the target object
 * @param property_key optional property key on the target
 * @returns a new map containing all own metadata
 */
export function get_all_own_metadata(
   target: object,
   property_key?: PropertyKey
): Map<any, any> {
   validate_target(target);
   const metadata_map = get_metadata_map(target, property_key, false);

   return metadata_map ? new Map(metadata_map) : new Map();
}

/**
 * gets all unique metadata key-value pairs from the target object and its entire prototype chain
 * metadata from derived objects overrides metadata from their prototypes
 *
 * @param target the target object
 * @param property_key optional property key on the target
 * @returns a new map containing all merged metadata
 */
export function get_all_metadata(
   target: object,
   property_key?: PropertyKey
): Map<any, any> {
   validate_target(target);

   const all_meta = new Map<any, any>();
   const prototypes: object[] = [];
   let current_target: object | null = target;

   while (current_target) {
      prototypes.push(current_target);
      current_target = get_prototype(current_target);
   }

   for (let i = prototypes.length - 1; i >= 0; i--) {
      const proto = prototypes[i]!;
      const own_meta = get_all_own_metadata(proto, property_key);

      for (const [key, value] of own_meta.entries()) {
         all_meta.set(key, value);
      }
   }

   return all_meta;
}

//
//

/**
 * a unique, internal symbol to store injection metadata on a target
 */
const INJECTION_METADATA_KEY = Symbol('eldritch:injections');

/**
 * a unique, internal symbol to store the set of property keys that are injection targets
 */
const INJECTION_TARGETS_KEY = Symbol('eldritch:injection_targets');

/**
 * associates injection metadata with a specific parameter of a method
 *
 * this also implicitly marks the method as an injection target
 *
 * @param target the class prototype
 * @param property_key the method name
 * @param parameter_index the index of the parameter
 * @param injection_data the metadata object for this injection
 */
export function define_injection_metadata(
   target: object,
   property_key: PropertyKey,
   parameter_index: number,
   injection_data: unknown
): void {
   validate_target(target);

   let targets = get_own_metadata(INJECTION_TARGETS_KEY, target) as Set<PropertyKey> | undefined;

   if (!targets) {
      targets = new Set<PropertyKey>();
      define_metadata(INJECTION_TARGETS_KEY, targets, target);
   }

   targets.add(property_key);

   let injections = get_own_metadata(INJECTION_METADATA_KEY, target, property_key) as Map<number, any> | undefined;

   if (!injections) {
      injections = new Map<number, any>();
      define_metadata(INJECTION_METADATA_KEY, injections, target, property_key);
   }

   injections.set(parameter_index, injection_data);
}

/**
 * associates all injection metadata for a method at once
 *
 * this is more efficient than multiple `define_injection_metadata` calls
 *
 * @param target the class prototype
 * @param property_key the method name
 * @param injections a map where the key is the parameter index and the value is the injection metadata
 */
export function define_all_injection_metadata(
   target: object,
   property_key: PropertyKey,
   injections: Map<number, unknown>
): void {
   validate_target(target);

   let targets = get_own_metadata(INJECTION_TARGETS_KEY, target) as Set<PropertyKey> | undefined;

   if (!targets) {
      targets = new Set<PropertyKey>();
      define_metadata(INJECTION_TARGETS_KEY, targets, target);
   }

   targets.add(property_key);
   define_metadata(INJECTION_METADATA_KEY, injections, target, property_key);
}

/**
 * retrieves all injection metadata for a given method, merged across the prototype chain
 *
 * @param target the class prototype
 * @param property_key the method name
 *
 * @returns a map where the key is the parameter index and the value is the injection metadata
 */
export function get_injection_metadata(
   target: object,
   property_key: PropertyKey
): Map<number, unknown> {
   validate_target(target);

   const all_injections = new Map<number, unknown>();
   const prototypes: object[] = [];
   let current_target: object | null = target;

   while (current_target) {
      prototypes.push(current_target);
      current_target = get_prototype(current_target);
   }

   for (let i = prototypes.length - 1; i >= 0; i--) {
      const proto = prototypes[i]!;
      const own_injections = get_own_metadata(INJECTION_METADATA_KEY, proto, property_key) as Map<number, any> | undefined;

      if (own_injections) {
         for (const [index, data] of own_injections.entries()) {
            all_injections.set(index, data);
         }
      }
   }

   return all_injections;
}

/**
 * lists all method names (property keys) on a target and its prototype chain that have been marked for injection
 *
 * @param target the class prototype
 *
 * @returns an array of unique property keys that are injection targets
 */
export function list_injection_targets(
   target: object
): PropertyKey[] {
   validate_target(target);

   const all_targets = new Set<PropertyKey>();
   let current_target: object | null = target;

   while (current_target) {
      const own_targets = get_own_metadata(INJECTION_TARGETS_KEY, current_target) as Set<PropertyKey> | undefined;

      if (own_targets) {
         for (const key of own_targets) {
            all_targets.add(key);
         }
      }

      current_target = get_prototype(current_target);
   }

   return [...all_targets];
}