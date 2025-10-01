/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/tests/runtime/allocator/allocator_string_realloc.test.ts
 */

import { describe, expect, it, beforeEach } from 'bun:test';

import type { Pointer } from '@eldritch-engine/type-utils/guerrero/index';

import { TlsfAllocator } from '@self/runtime/allocator/allocator';
import { BLOCK_PAYLOAD_MIN_SIZE, GLOBAL_NULL_POINTER } from '@self/runtime/allocator/constants';

const text_encoder = new TextEncoder();
const text_decoder = new TextDecoder();

function write_simulated_string(
   buffer: ArrayBuffer,
   user_ptr: Pointer,
   content: string
): number {
   const encoded_bytes = text_encoder.encode(content);
   const total_payload_needed = 4 + encoded_bytes.byteLength;
   const view = new DataView(buffer);

   view.setUint32(user_ptr, encoded_bytes.byteLength, true);
   const dest_array = new Uint8Array(buffer, user_ptr + 4, encoded_bytes.byteLength);
   dest_array.set(encoded_bytes);

   return total_payload_needed;
}

function read_simulated_string(
   buffer: ArrayBuffer,
   user_ptr: Pointer
): string | null {
   if (
      user_ptr === GLOBAL_NULL_POINTER
   ) {
      return '';
   }

   const view = new DataView(buffer);
   const length = view.getUint32(user_ptr, true);

   if (length === 0) {
      return '';
   }

   const string_bytes = new Uint8Array(buffer, user_ptr + 4, length);

   return text_decoder.decode(string_bytes);
}

function get_required_payload_size_for_string(
   str: string
): number {
   return 4 + text_encoder.encode(str).byteLength;
}

describe('TlsfAllocator string reallocation scenarios', () => {
   const POOL_SIZE = 1024;

   let allocator: TlsfAllocator;
   let main_buffer: ArrayBuffer;

   beforeEach(() => {
      main_buffer = new ArrayBuffer(POOL_SIZE);
      allocator = new TlsfAllocator(main_buffer, 0, POOL_SIZE);
   });

   it('should reallocate from short to long string without corruption (simulating DynamicStringStructView)', () => {
      const short_string_content = 'short';
      const long_string_content = 'this is a much longer string that will require reallocation';

      const short_string_payload_req = get_required_payload_size_for_string(short_string_content);
      const long_string_payload_req = get_required_payload_size_for_string(long_string_content);

      let user_ptr = allocator.allocate(short_string_payload_req);
      expect(user_ptr).not.toBe(GLOBAL_NULL_POINTER);

      const user_ptr_initial = user_ptr;

      write_simulated_string(main_buffer, user_ptr, short_string_content);
      expect(read_simulated_string(main_buffer, user_ptr)).toBe(short_string_content);

      const ptemp1 = allocator.allocate(BLOCK_PAYLOAD_MIN_SIZE);

      const new_user_ptr = allocator.reallocate(user_ptr, long_string_payload_req);
      expect(new_user_ptr).not.toBe(GLOBAL_NULL_POINTER);
      user_ptr = new_user_ptr;

      write_simulated_string(main_buffer, user_ptr, long_string_content);

      const result_string = read_simulated_string(main_buffer, user_ptr);

      expect(result_string).toBe(long_string_content);

      if (user_ptr !== GLOBAL_NULL_POINTER) {
         allocator.free(user_ptr);
      }

      if (
         ptemp1 !== GLOBAL_NULL_POINTER
         && ptemp1 !== user_ptr
         && ptemp1 !== user_ptr_initial
      ) {
         allocator.free(ptemp1);
      }
   });

   it('multiple reallocations (grow, shrink, grow) with string data', () => {
      const str1 = 'One';
      const str2 = 'TwoTwo';
      const str3 = 'ThreeThreeThree';
      const str4 = 'Four';

      const req1 = get_required_payload_size_for_string(str1);
      const req2 = get_required_payload_size_for_string(str2);
      const req3 = get_required_payload_size_for_string(str3);
      const req4 = get_required_payload_size_for_string(str4);

      let p = allocator.allocate(req1);
      expect(p).not.toBe(GLOBAL_NULL_POINTER);
      write_simulated_string(main_buffer, p, str1);
      expect(read_simulated_string(main_buffer, p)).toBe(str1);

      p = allocator.reallocate(p, req2);
      expect(p).not.toBe(GLOBAL_NULL_POINTER);
      write_simulated_string(main_buffer, p, str2);
      expect(read_simulated_string(main_buffer, p)).toBe(str2);

      p = allocator.reallocate(p, req3);
      expect(p).not.toBe(GLOBAL_NULL_POINTER);
      write_simulated_string(main_buffer, p, str3);
      expect(read_simulated_string(main_buffer, p)).toBe(str3);

      p = allocator.reallocate(p, req4);
      expect(p).not.toBe(GLOBAL_NULL_POINTER);
      write_simulated_string(main_buffer, p, str4);
      expect(read_simulated_string(main_buffer, p)).toBe(str4);

      allocator.free(p);
   });

   it('reallocate grow by merging with deliberately freed next block', () => {
      const str_initial_content = 'initial';
      const str_obstacle_content = 'obstacle';
      const str_final_content = 'final_string_much_longer_than_initial';

      const req_initial = get_required_payload_size_for_string(str_initial_content);
      const req_obstacle = get_required_payload_size_for_string(str_obstacle_content);
      const req_final = get_required_payload_size_for_string(str_final_content);

      let ptr_initial = allocator.allocate(req_initial);
      expect(ptr_initial).not.toBe(GLOBAL_NULL_POINTER);
      write_simulated_string(main_buffer, ptr_initial, str_initial_content);

      let ptr_obstacle = allocator.allocate(req_obstacle);
      expect(ptr_obstacle).not.toBe(GLOBAL_NULL_POINTER);
      write_simulated_string(main_buffer, ptr_obstacle, str_obstacle_content);

      allocator.free(ptr_obstacle);

      const ptr_final = allocator.reallocate(ptr_initial, req_final);
      expect(ptr_final).not.toBe(GLOBAL_NULL_POINTER);
      expect(ptr_final).toBe(ptr_initial);

      write_simulated_string(main_buffer, ptr_final, str_final_content);
      const result = read_simulated_string(main_buffer, ptr_final);
      expect(result).toBe(str_final_content);

      allocator.free(ptr_final);
   });
});