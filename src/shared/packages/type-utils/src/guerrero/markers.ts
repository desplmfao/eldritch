/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/type-utils/src/guerrero/markers.ts
 */

import type {
   IGuerreroArray,
   IGuerreroFixedArray,
   IGuerreroMap,
   IGuerreroSet,
   IGuerreroSparseSet
} from '@self/guerrero/interfaces';

import type { guerrero_omit } from '@self/guerrero/index';

/**
 * recursively unwraps guerrero-branded types into their corresponding native javascript types
 *
 * @template T the guerrero type to unwrap
 */
export type t<T, K extends keyof T = never> = guerrero_omit<T, K>;

/** boolean type stored as a single byte (0 or 1) */
export type bool = boolean & { __guerrero: true };

/** 8-bit unsigned integer type */
export type u8 = number & { __guerrero: true };
/** 16-bit unsigned integer type */
export type u16 = number & { __guerrero: true };
/** 32-bit unsigned integer type */
export type u32 = number & { __guerrero: true };
/** 64-bit unsigned integer type */
export type u64 = bigint & { __guerrero: true };

/** 8-bit signed integer type */
export type i8 = number & { __guerrero: true };
/** 16-bit signed integer type */
export type i16 = number & { __guerrero: true };
/** 32-bit signed integer type */
export type i32 = number & { __guerrero: true };
/** 64-bit signed integer type */
export type i64 = bigint & { __guerrero: true };

/** 32-bit floating-point number type */
export type f32 = number & { __guerrero: true };
/** 64-bit floating-point number type */
export type f64 = number & { __guerrero: true };

/** represents a dynamically allocated, utf-8 encoded string */
export type str = string & { __guerrero: true };

/** @internal */
export type valid_prim = ((u8 | u16 | u32 | u64) | (i8 | i16 | i32 | i64) | (f32 | f64)) | bool;

/**
 * fixed-size array type. the length `L` is part of the type signature
 * 
 * this type resolves to a generated class that implements the `IGuerreroFixedArray` interface
 */
export type fixed_arr<T, L extends number> = IGuerreroFixedArray<T, L> & { __guerrero: true };

/**
 * dynamic-size array type
 * 
 * this type resolves to a generated class that implements the `IGuerreroArray` interface
 */
export type arr<T> = IGuerreroArray<T> & { __guerrero: true };

/**
 * dynamic-size map type
 *
 * @template K - the key type
 * @template V - the value type, which can be a primitive, a `str`, or an `IView`-compatible struct
 */
export type map<K, V> = IGuerreroMap<K, V> & { __guerrero: true };

/**
 * dynamic-size set type
 *
 * @template V - the element type for the set
 */
export type set<V> = IGuerreroSet<V> & { __guerrero: true };

/** sparse set data structure */
export type sparseset = IGuerreroSparseSet & { __guerrero: true };