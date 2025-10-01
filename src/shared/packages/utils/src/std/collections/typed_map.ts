/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/utils/src/std/collections/typed_map.ts
 */

/**
 * a map that provides strong typing based on a defined interface or object type
 *
 * @template T - the object type defining the keys and value types
 * @template InterfaceKey - the specific keys from T to be used in the map
 */
export class TypedMap<T extends object, InterfaceKey extends keyof T = keyof T> {
   #map: Map<InterfaceKey, T[InterfaceKey]> = new Map();

   get size(): number {
      return this.#map.size;
   }

   constructor(initial_values?: readonly (readonly [InterfaceKey, T[InterfaceKey]])[] | null) {
      if (initial_values) {
         this.#map = new Map(initial_values);
      }
   }

   get<K extends InterfaceKey>(key: K): T[K] | undefined {
      return this.#map.get(key) as T[K] | undefined;
   }

   set(key: InterfaceKey, value: T[InterfaceKey]): this {
      this.#map.set(key, value);

      return this;
   }

   has<K extends InterfaceKey>(key: K): boolean {
      return this.#map.has(key);
   }

   delete<K extends InterfaceKey>(key: K): boolean {
      return this.#map.delete(key);
   }

   clear(): void {
      return this.#map.clear();
   }

   keys(): IterableIterator<InterfaceKey> {
      return this.#map.keys();
   }

   values(): IterableIterator<T[InterfaceKey]> {
      return this.#map.values();
   }

   entries(): IterableIterator<[InterfaceKey, T[InterfaceKey]]> {
      return this.#map.entries();
   }
}

/**
 * a strongly-typed map that creates a default value when a non-existent key is accessed
 *
 * @template T - the object type defining the keys and value types
 * @template InterfaceKey - the specific keys from T to be used in the map
 */
export class DefaultTypedMap<T extends object, InterfaceKey extends keyof T = keyof T> extends TypedMap<T, InterfaceKey> {
   #default_factory: (key: InterfaceKey) => T[InterfaceKey];

   /**
    * creates a new DefaultTypedMap
    *
    * @param default_factory - a function that will be called to generate a default value when a key is accessed for the first time. the key is passed to the factory
    * @param initial_values - optional initial values for the map
    */
   constructor(
      default_factory: (key: InterfaceKey) => T[InterfaceKey],
      initial_values?: readonly (readonly [InterfaceKey, T[InterfaceKey]])[] | null
   ) {
      super(initial_values);

      this.#default_factory = default_factory;
   }

   /**
    * gets the value for a key. if the key does not exist, a default value is
    * created using the factory, inserted into the map, and then returned
    *
    * unlike TypedMap, this method does not return `undefined`
    *
    * @param key - the key to retrieve
    * @returns the value associated with the key
    */
   override get<K extends InterfaceKey>(key: K): T[K] {
      if (!super.has(key)) {
         const default_value = this.#default_factory(key);

         this.set(key, default_value);
      }

      return super.get(key)!;
   }
}