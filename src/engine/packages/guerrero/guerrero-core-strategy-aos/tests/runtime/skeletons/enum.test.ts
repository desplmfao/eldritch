/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/runtime/skeletons/enum.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import type { IView, Pointer, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { LITTLE_ENDIAN } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

enum PlayerState {
   Idle,
   Walking,
   Running = 10,
   Jumping,
}

enum ItemID {
   None = 0,
   Sword = 200,
   Shield = 500,
}

class MockComponentWithEnums implements IView {

   static readonly __schema: SchemaLayout = {
      class_name: MockComponentWithEnums.name,
      total_size: 4,
      alignment: 2,
      has_dynamic_data: false,
      properties: [
         {
            property_key: 'state',
            type: 'PlayerState',
            order: 0,
            offset: 0,
            size: 1,
            alignment: 1,
            start_line: 0,
            end_line: 0,
            binary_info: {
               size: 1,
               alignment: 1,
               is_enum: true,
            },
            enum_base_type: 'u8',
            enum_members: [
               {
                  name: 'Idle',
                  value: 0
               },
               {
                  name: 'Walking',
                  value: 1
               },
               {
                  name: 'Running',
                  value: 10
               },
               {
                  name: 'Jumping',
                  value: 11
               },
            ],
         },
         {
            property_key: 'item',
            type: 'ItemID',
            order: 1,
            offset: 2,
            size: 2,
            alignment: 2,
            start_line: 0,
            end_line: 0,
            binary_info: {
               size: 2,
               alignment: 2,
               is_enum: true,
            },
            enum_base_type: 'u16',
            enum_members: [
               {
                  name: 'None',
                  value: 0
               },
               {
                  name: 'Sword',
                  value: 200
               },
               {
                  name: 'Shield',
                  value: 500
               },
            ],
         },
      ],
   };

   private static readonly $valid_state_values = new Set([0, 1, 10, 11]);
   private static readonly $valid_item_id_values = new Set([0, 200, 500]);

   readonly __view: DataView;
   readonly __buffer: ArrayBufferLike;
   readonly __byte_offset: Pointer;
   readonly __allocator?: TlsfAllocator;

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator?: TlsfAllocator
   ) {
      this.__buffer = buffer;
      this.__byte_offset = byte_offset;
      this.__allocator = allocator;
      this.__view = new DataView(buffer);
   }

   get state(): PlayerState {
      const prop_schema = MockComponentWithEnums.__schema.properties[0]!;

      return this.__view.getUint8(this.__byte_offset + prop_schema.offset) as PlayerState;
   }

   set state(value: PlayerState) {
      /// #if SAFETY
      if (!MockComponentWithEnums.$valid_state_values.has(value)) {
         throw new RangeError(`invalid value for enum 'PlayerState'. received '${value}'`);
      }
      /// #endif

      const prop_schema = MockComponentWithEnums.__schema.properties[0]!;
      this.__view.setUint8(this.__byte_offset + prop_schema.offset, value);
   }

   get item(): ItemID {
      const prop_schema = MockComponentWithEnums.__schema.properties[1]!;

      return this.__view.getUint16(this.__byte_offset + prop_schema.offset, LITTLE_ENDIAN) as ItemID;
   }

   set item(value: ItemID) {
      /// #if SAFETY
      if (!MockComponentWithEnums.$valid_item_id_values.has(value)) {
         throw new RangeError(`invalid value for enum 'ItemID'. received '${value}'`);
      }
      /// #endif

      const prop_schema = MockComponentWithEnums.__schema.properties[1]!;
      this.__view.setUint16(this.__byte_offset + prop_schema.offset, value, LITTLE_ENDIAN);
   }
}

describe('runtime skeletons - enum properties', () => {
   let allocator: TlsfAllocator;
   let component_buffer: ArrayBuffer;
   let component: MockComponentWithEnums;

   beforeEach(() => {
      const pool_buffer = new ArrayBuffer(1024);

      allocator = new TlsfAllocator(pool_buffer);
      component_buffer = new ArrayBuffer(MockComponentWithEnums.__schema.total_size);
      component = new MockComponentWithEnums(component_buffer, 0, allocator);
   });

   it('should set and get a default (u8) enum value', () => {
      component.state = PlayerState.Walking;
      expect(component.state).toBe(PlayerState.Walking);

      component.state = PlayerState.Running;
      expect(component.state).toBe(PlayerState.Running);
      expect(component.state).toBe(10);
   });

   it('should set and get a u16 enum value', () => {
      component.item = ItemID.Sword;
      expect(component.item).toBe(ItemID.Sword);
      expect(component.item).toBe(200);

      component.item = ItemID.Shield;
      expect(component.item).toBe(ItemID.Shield);
      expect(component.item).toBe(500);
   });

   /// #if SAFETY
   it('should throw an error when setting an invalid enum value', () => {
      expect(() => {
         component.state = 99 as PlayerState;
      }).toThrow(/invalid value for enum 'PlayerState'/);

      expect(() => {
         component.item = 123 as ItemID;
      }).toThrow(/invalid value for enum 'ItemID'/);
   });
   /// #endif

   it('should not throw for valid enum values', () => {
      expect(() => {
         component.state = PlayerState.Jumping;
      }).not.toThrow();
      expect(component.state).toBe(11);

      expect(() => {
         component.item = ItemID.None;
      }).not.toThrow();
      expect(component.item).toBe(0);
   });
});