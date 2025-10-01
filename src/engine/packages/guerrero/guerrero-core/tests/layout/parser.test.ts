/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/tests/layout/parser.test.ts
 */

import { describe, it, expect } from 'bun:test';

import { TypeParser } from '@self/layout/parser/parser';

describe('TypeParser', () => {

   const parse = (input: string) => new TypeParser(input).parse();

   it('should parse primitive types', () => {
      expect(parse('u32')).toEqual({
         kind: 'primitive',
         name: 'u32'
      });

      expect(parse('f64')).toEqual({
         kind: 'primitive',
         name: 'f64'
      });

      expect(parse('bool')).toEqual({
         kind: 'primitive',
         name: 'bool'
      });

      expect(parse('str')).toEqual({
         kind: 'primitive',
         name: 'str'
      });

   });

   it('should parse a user-defined identifier', () => {
      expect(parse('MyStruct')).toEqual({
         kind: 'identifier',
         name: 'MyStruct'
      });
   });

   it('should parse a sparseset', () => {
      expect(parse('sparseset')).toEqual({
         kind: 'sparseset'
      });
   });

   describe('arrays', () => {
      it('should parse dynamic array suffix `[]`', () => {
         expect(parse('u32[]')).toEqual({
            kind: 'dynamic_array',
            element_type: {
               kind: 'primitive',
               name: 'u32'
            },
         });
      });

      it('should parse nested dynamic array suffix `[][]`', () => {
         expect(parse('str[][]')).toEqual({
            kind: 'dynamic_array',
            element_type: {
               kind: 'dynamic_array',
               element_type: {
                  kind: 'primitive',
                  name: 'str'
               },
            },
         });
      });

      it('should parse generic dynamic array `arr<T>`', () => {
         expect(parse('arr<MyStruct>')).toEqual({
            kind: 'dynamic_array',
            element_type: {
               kind: 'identifier',
               name: 'MyStruct'
            },
         });
      });

      it('should parse generic fixed array `fixed_arr<T, L>`', () => {
         expect(parse('fixed_arr<f32, 3>')).toEqual({
            kind: 'fixed_array',
            element_type: {
               kind: 'primitive',
               name: 'f32'
            },
            count: 3,
         });
      });

      it('should parse bracket fixed array `[T, L]`', () => {
         expect(parse('[u8, 16]')).toEqual({
            kind: 'fixed_array',
            element_type: {
               kind: 'primitive',
               name: 'u8'
            },
            count: 16,
         });
      });

      it('should parse a homogeneous tuple `[T, T, T]`', () => {
         expect(parse('[f32, f32, f32]')).toEqual({
            kind: 'tuple',
            element_types: [
               {
                  kind: 'primitive',
                  name: 'f32'
               },
               {
                  kind: 'primitive',
                  name: 'f32'
               },
               {
                  kind: 'primitive',
                  name: 'f32'
               },
            ],
         });
      });

      it('should parse a heterogeneous tuple `[T1, T2, T3]`', () => {
         expect(parse('[u32, str, bool]')).toEqual({
            kind: 'tuple',
            element_types: [
               {
                  kind: 'primitive',
                  name: 'u32'
               },
               {
                  kind: 'primitive',
                  name: 'str'
               },
               {
                  kind: 'primitive',
                  name: 'bool'
               },
            ],
         });
      });

      it('should parse nested arrays', () => {
         expect(parse('fixed_arr<u32[], 4>')).toEqual({
            kind: 'fixed_array',
            element_type: {
               kind: 'dynamic_array',
               element_type: {
                  kind: 'primitive',
                  name: 'u32'
               },
            },
            count: 4,
         });

         expect(parse('arr<fixed_arr<bool, 2>>')).toEqual({
            kind: 'dynamic_array',
            element_type: {
               kind: 'fixed_array',
               element_type: {
                  kind: 'primitive',
                  name: 'bool'
               },
               count: 2,
            },
         });
      });

      it('should parse deeply nested arrays and tuples', () => {
         expect(parse('fixed_arr<arr<[MyStruct, 2]>, 8>[][]')).toEqual({
            kind: 'dynamic_array',
            element_type: {
               kind: 'dynamic_array',
               element_type: {
                  kind: 'fixed_array',
                  count: 8,
                  element_type: {
                     kind: 'dynamic_array',
                     element_type: {
                        kind: 'fixed_array',
                        count: 2,
                        element_type: {
                           kind: 'identifier',
                           name: 'MyStruct'
                        },
                     },
                  },
               },
            },
         });
      });

      it('should parse a dynamic array of a union', () => {
         expect(parse('(u32 | str)[]')).toEqual({
            kind: 'dynamic_array',
            element_type: {
               kind: 'union',
               variants: [
                  { kind: 'primitive', name: 'u32' },
                  { kind: 'primitive', name: 'str' },
               ],
            },
         });
      });
   });

   describe('collections', () => {
      it('should parse a map', () => {
         expect(parse('map<str, u32>')).toEqual({
            kind: 'map',
            key_type: {
               kind: 'primitive',
               name: 'str'
            },
            value_type: {
               kind: 'primitive',
               name: 'u32'
            },
         });
      });

      it('should parse a set', () => {
         expect(parse('set<MyComponent>')).toEqual({
            kind: 'set',
            element_type: {
               kind: 'identifier',
               name: 'MyComponent'
            },
         });
      });

      it('should parse collections with complex nested types', () => {
         expect(parse('map<u16, fixed_arr<str, 4>[]>')).toEqual({
            kind: 'map',
            key_type: {
               kind: 'primitive',
               name: 'u16'
            },
            value_type: {
               kind: 'dynamic_array',
               element_type: {
                  kind: 'fixed_array',
                  element_type: {
                     kind: 'primitive',
                     name: 'str'
                  },
                  count: 4,
               },
            },
         });
      });
   });

   describe('unions', () => {
      it('should parse a simple union of primitives', () => {
         expect(parse('u8 | u32')).toEqual({
            kind: 'union',
            variants: [
               {
                  kind: 'primitive',
                  name: 'u8'
               },
               {
                  kind: 'primitive',
                  name: 'u32'
               },
            ],
         });
      });

      it('should parse a union with null', () => {
         expect(parse('str | null')).toEqual({
            kind: 'union',
            variants: [
               {
                  kind: 'primitive',
                  name: 'str'
               },
               {
                  kind: 'null'
               },
            ],
         });
      });

      it('should parse a union with complex types', () => {
         expect(parse('u32 | MyStruct[] | map<u8, bool>')).toEqual({
            kind: 'union',
            variants: [
               {
                  kind: 'primitive',
                  name: 'u32'
               },
               {
                  kind: 'dynamic_array',
                  element_type: {
                     kind: 'identifier',
                     name: 'MyStruct'
                  },
               },
               {
                  kind: 'map',
                  key_type: {
                     kind: 'primitive',
                     name: 'u8'
                  },
                  value_type: {
                     kind: 'primitive',
                     name: 'bool'
                  },
               },
            ],
         });
      });

      it('should correctly handle precedence with array suffixes', () => {
         expect(parse('u32 | str[]')).toEqual({
            kind: 'union',
            variants: [
               {
                  kind: 'primitive',
                  name: 'u32'
               },
               {
                  kind: 'dynamic_array',
                  element_type: {
                     kind: 'primitive',
                     name: 'str'
                  },
               },
            ],
         });
      });
   });

   describe('complex and nested types', () => {
      it('should parse a dynamic array of a fixed-size array', () => {
         expect(parse('arr<[u8, 4]>')).toEqual({
            kind: 'dynamic_array',
            element_type: {
               kind: 'fixed_array',
               element_type: {
                  kind: 'primitive',
                  name: 'u8'
               },
               count: 4,
            },
         });
      });

      it('should parse a complex union with nested collections', () => {
         expect(parse('DeeplyNestedStruct | u32[] | map<u16, str> | null')).toEqual({
            kind: 'union',
            variants: [
               {
                  kind: 'identifier',
                  name: 'DeeplyNestedStruct'
               },
               {
                  kind: 'dynamic_array',
                  element_type: {
                     kind: 'primitive',
                     name: 'u32'
                  },
               },
               {
                  kind: 'map',
                  key_type: {
                     kind: 'primitive',
                     name: 'u16'
                  },
                  value_type: {
                     kind: 'primitive',
                     name: 'str'
                  },
               },
               {
                  kind: 'null'
               },
            ],
         });
      });

      it('should parse a map with a dynamic array of a union as its value', () => {
         expect(parse('map<str, (u32 | bool)[]>')).toEqual({
            kind: 'map',
            key_type: {
               kind: 'primitive',
               name: 'str'
            },
            value_type: {
               kind: 'dynamic_array',
               element_type: {
                  kind: 'union',
                  variants: [
                     {
                        kind: 'primitive',
                        name: 'u32'
                     },
                     {
                        kind: 'primitive',
                        name: 'bool'
                     },
                  ],
               },
            },
         });
      });

      it('should parse a set of complex tuples', () => {
         expect(parse('set<[u32, str, MyStruct[]]>')).toEqual({
            kind: 'set',
            element_type: {
               kind: 'tuple',
               element_types: [
                  {
                     kind: 'primitive',
                     name: 'u32'
                  },
                  {
                     kind: 'primitive',
                     name: 'str'
                  },
                  {
                     kind: 'dynamic_array',
                     element_type: {
                        kind: 'identifier',
                        name: 'MyStruct'
                     },
                  },
               ],
            },
         });
      });

      it('should parse a fixed array of an optional dynamic array', () => {
         expect(parse('fixed_arr<(u32[] | null), 4>')).toEqual({
            kind: 'fixed_array',
            count: 4,
            element_type: {
               kind: 'union',
               variants: [
                  {
                     kind: 'dynamic_array',
                     element_type: {
                        kind: 'primitive',
                        name: 'u32'
                     },
                  },
                  {
                     kind: 'null'
                  },
               ],
            },
         });
      });

      it('should handle redundant parentheses', () => {
         expect(parse('((u32))[]')).toEqual({
            kind: 'dynamic_array',
            element_type: {
               kind: 'primitive',
               name: 'u32'
            },
         });
      });

      it('should parse deeply nested generic arrays', () => {
         expect(parse('arr<arr<arr<u32>>>')).toEqual({
            kind: 'dynamic_array',
            element_type: {
               kind: 'dynamic_array',
               element_type: {
                  kind: 'dynamic_array',
                  element_type: {
                     kind: 'primitive',
                     name: 'u32'
                  },
               },
            },
         });
      });
   });


   describe('error handling', () => {
      it('should throw on unclosed generic', () => {
         expect(() => parse('arr<u32')).toThrow(/expected '>'/);
      });

      it('should throw on mismatched bracket', () => {
         expect(() => parse('[u32, 5')).toThrow(/expected ']'/);
      });

      it('should throw on missing comma in generic', () => {
         expect(() => parse('map<u32 u32>')).toThrow(/expected ','/);
      });

      it('should throw on trailing characters', () => {
         expect(() => parse('u32 extra')).toThrow(/unexpected character 'e'/);
      });

      it('should throw on invalid single-element array', () => {
         expect(() => parse('[u32]')).toThrow(/single-element bracketed array/);
      });

      it('should throw on missing number in fixed-size array definitions', () => {
         expect(() => parse('fixed_arr<str, >')).toThrow(/expected a number/);
      });

      it('should throw on trailing commas in array/tuple definitions', () => {
         expect(() => parse('[u8, ]')).toThrow(/trailing comma/);
         expect(() => parse('[u8, u32, ]')).toThrow(/trailing comma/);
      });
   });
});