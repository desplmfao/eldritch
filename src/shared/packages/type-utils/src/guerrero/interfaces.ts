/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/type-utils/src/guerrero/interfaces.ts
 */

import type { IView } from '@self/guerrero/index';

export interface IGuerreroArray<T> extends IView, Iterable<T> {
   readonly length: number;

   [n: number]: T | undefined;

   get(index: number): T | undefined;
   set(index: number, value: T): boolean;
   push(...values: T[]): number;
   pop(): T | undefined;

   indexOf(search_element: T, from_index?: number): number;
   includes(search_element: T, from_index?: number): boolean;

   [Symbol.iterator](): IterableIterator<T>;
   entries(): IterableIterator<[number, T]>;
   keys(): IterableIterator<number>;
   values(): IterableIterator<T>;

   free(): void;
   $copy_from(source: this | Iterable<T>): void;
}

// TODO: make the array accessors have hard coded numbers for the fixed length and everything else is `T | undefined` 
export interface IGuerreroFixedArray<T, L extends number> extends IView, Iterable<T> {
   readonly length: L;

   [n: number]: T;

   get(index: number): T | undefined;
   set(index: number, value: T): boolean;

   indexOf(search_element: T, from_index?: number): number;
   includes(search_element: T, from_index?: number): boolean;

   [Symbol.iterator](): IterableIterator<T>;
   entries(): IterableIterator<[number, T]>;
   keys(): IterableIterator<number>;
   values(): IterableIterator<T>;

   free(): void;
   $copy_from(source: this | Iterable<T>): void;
}

export interface IGuerreroMap<K, V> extends IView, Iterable<[K, V]> {
   readonly size: number;

   clear(): void;
   delete(key: K): boolean;
   get(key: K): V | undefined;
   has(key: K): boolean;
   set(key: K, value: V): this;

   [Symbol.iterator](): IterableIterator<[K, V]>;
   entries(): IterableIterator<[K, V]>;
   keys(): IterableIterator<K>;
   values(): IterableIterator<V>;

   free(): void;
   $copy_from(source: this | Map<K, V>): void;
}

export interface IGuerreroSet<T> extends IView, Iterable<T> {
   readonly size: number;

   add(value: T): this;
   clear(): void;
   delete(value: T): boolean;
   has(value: T): boolean;

   [Symbol.iterator](): IterableIterator<T>;
   entries(): IterableIterator<[T, T]>;
   keys(): IterableIterator<T>;
   values(): IterableIterator<T>;

   free(): void;
   $copy_from(source: this | Set<T> | T[]): void;
}

export interface IGuerreroSparseSet extends IView, Iterable<number> {
   readonly size: number;

   has(value: number): boolean;
   add(value: number): boolean;
   delete(value: number): boolean;
   clear(): void;

   [Symbol.iterator](): IterableIterator<number>;
   entries(): IterableIterator<[number, number]>;
   keys(): IterableIterator<number>;
   values(): IterableIterator<number>;

   free(): void;
   $copy_from(source: this | Iterable<number>): void;
}