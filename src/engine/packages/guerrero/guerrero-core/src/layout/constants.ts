/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/src/layout/constants.ts
 */

export interface PrimitiveTypeDetails {
   data_type: 'integer' | 'float' | 'boolean';
   size: number;
   alignment: number;
   getter: string;
   setter: string;
   needs_little_endian_arg: boolean;
   min_value?: number | bigint;
   max_value?: number | bigint;
   ts_type: string;
}

export const FIXED_PRIMITIVE_TYPE_DETAILS: ReadonlyMap<string, PrimitiveTypeDetails> = new Map([
   [
      'u8',
      {
         data_type: 'integer',
         size: 1,
         alignment: 1,
         getter: 'getUint8',
         setter: 'setUint8',
         needs_little_endian_arg: false,
         min_value: 0,
         max_value: 255,
         ts_type: 'number'
      }
   ],
   [
      'u16',
      {
         data_type: 'integer',
         size: 2,
         alignment: 2,
         getter: 'getUint16',
         setter: 'setUint16',
         needs_little_endian_arg: true,
         min_value: 0,
         max_value: 65535,
         ts_type: 'number'
      }
   ],
   [
      'u32',
      {
         data_type: 'integer',
         size: 4,
         alignment: 4,
         getter: 'getUint32',
         setter: 'setUint32',
         needs_little_endian_arg: true,
         min_value: 0,
         max_value: 4294967295,
         ts_type: 'number'
      }
   ],
   [
      'u64',
      {
         data_type: 'integer',
         size: 8,
         alignment: 8,
         getter: 'getBigUint64',
         setter: 'setBigUint64',
         needs_little_endian_arg: true,
         min_value: 0n,
         max_value: 0xFFFFFFFFFFFFFFFFn,
         ts_type: 'bigint'
      }
   ],
   [
      'i8',
      {
         data_type: 'integer',
         size: 1,
         alignment: 1,
         getter: 'getInt8',
         setter: 'setInt8',
         needs_little_endian_arg: false,
         min_value: -128,
         max_value: 127,
         ts_type: 'number'
      }
   ],
   [
      'i16',
      {
         data_type: 'integer',
         size: 2,
         alignment: 2,
         getter: 'getInt16',
         setter: 'setInt16',
         needs_little_endian_arg: true,
         min_value: -32768,
         max_value: 32767,
         ts_type: 'number'
      }
   ],
   [
      'i32',
      {
         data_type: 'integer',
         size: 4,
         alignment: 4,
         getter: 'getInt32',
         setter: 'setInt32',
         needs_little_endian_arg: true,
         min_value: -2147483648,
         max_value: 2147483647,
         ts_type: 'number'
      }
   ],
   [
      'i64',
      {
         data_type: 'integer',
         size: 8,
         alignment: 8,
         getter: 'getBigInt64',
         setter: 'setBigInt64',
         needs_little_endian_arg: true,
         min_value: -0x8000000000000000n,
         max_value: 0x7FFFFFFFFFFFFFFFn,
         ts_type: 'bigint'
      }
   ],
   [
      'f32',
      {
         data_type: 'float',
         size: 4,
         alignment: 4,
         getter: 'getFloat32',
         setter: 'setFloat32',
         needs_little_endian_arg: true,
         ts_type: 'number'
      }
   ],
   [
      'f64',
      {
         data_type: 'float',
         size: 8,
         alignment: 8,
         getter: 'getFloat64',
         setter: 'setFloat64',
         needs_little_endian_arg: true,
         ts_type: 'number'
      }
   ],
   [
      'bool',
      {
         data_type: 'boolean',
         size: 1,
         alignment: 1,
         getter: 'getUint8',
         setter: 'setUint8',
         needs_little_endian_arg: false,
         min_value: 0,
         max_value: 1,
         ts_type: 'boolean'
      }
   ],
]);


export const FIXED_PRIMITIVE_TYPES: ReadonlySet<string> = new Set(FIXED_PRIMITIVE_TYPE_DETAILS.keys());