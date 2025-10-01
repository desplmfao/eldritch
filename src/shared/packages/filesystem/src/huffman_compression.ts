/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/filesystem/src/huffman_compression.ts
 */

import {
   huffman_encode,
   huffman_decode,
   huffman_serialize_tree,
   huffman_deserialize_tree
} from '@eldritch-engine/utils/std/algorithms/huffman';

/**
 * compresses an ArrayBufferLike by converting it to text (utf-8),
 * encoding it with Huffman, and then combining a small header,
 * the serialized Huffman tree, and the encoded payload.
 *
 * the header contains:
 *   - u32 (little-endian): bit_length (number of valid bits in payload)
 *   - u32 (little-endian): tree_bytes.byteLength
 *
 * @param buffer - the raw file data
 *
 * @returns a new ArrayBufferLike of the compressed data
 */
export function compress_data(
   buffer: ArrayBufferLike
): ArrayBufferLike {
   const text = new TextDecoder().decode(new Uint8Array(buffer));
   const huff_result = huffman_encode(text);
   const tree_bytes = huffman_serialize_tree(huff_result.tree);

   const header = new ArrayBuffer(8);
   const header_view = new DataView(header);

   header_view.setUint32(0, huff_result.bit_length, true);
   header_view.setUint32(4, tree_bytes.byteLength, true);

   const payload = new Uint8Array(huff_result.encoded);
   const final_size = header.byteLength + tree_bytes.byteLength + payload.byteLength;
   const combined = new Uint8Array(final_size);

   combined.set(new Uint8Array(header), 0);
   combined.set(tree_bytes, header.byteLength);
   combined.set(payload, header.byteLength + tree_bytes.byteLength);

   return combined.buffer;
}

/**
 * decompresses data previously compressed by compress_data.
 * it reads the header to get the bit length and tree size, deserializes
 * the huffman tree, and then decodes the payload.
 *
 * @param buffer - the compressed ArrayBufferLike from storage
 *
 * @returns the original uncompressed data as an ArrayBufferLike
 */
export function decompress_data(buffer: ArrayBufferLike): ArrayBufferLike {
   const data = new Uint8Array(buffer);

   if (data.byteLength < 8) {
      throw new Error('invalid compressed data: too short.');
   }

   const header_view = new DataView(buffer, 0, 8);
   const bit_length = header_view.getUint32(0, true);
   const tree_length = header_view.getUint32(4, true);

   if (data.byteLength < 8 + tree_length) {
      throw new Error('invalid compressed data: incomplete tree data.');
   }

   const tree_bytes = data.slice(8, 8 + tree_length);
   const payload = data.slice(8 + tree_length);
   const { node: tree } = huffman_deserialize_tree(tree_bytes);
   const decoded_text = huffman_decode(payload.buffer, bit_length, tree);

   return new TextEncoder().encode(decoded_text).buffer;
}
