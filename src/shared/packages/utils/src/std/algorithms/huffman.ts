/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/utils/src/std/algorithms/huffman.ts
 */

/**
 * represents a node in the huffman tree
 */
export interface HuffmanNode {
   /** the character represented by the node (if it is a leaf node) */
   char?: string;
   /** the frequency/count for the character(s) represented by this node */
   freq: number;
   /** the left child node */
   left?: HuffmanNode;
   /** the right child node */
   right?: HuffmanNode;
}

/**
 * represents the result of a huffman encoding
 */
export interface HuffmanEncoded {
   /** the encoded content as an 'ArrayBuffer' */
   encoded: ArrayBufferLike;
   /** the total number of valid bits in the encoded output */
   bit_length: number;
   /** the Huffman tree used for encoding */
   tree: HuffmanNode;
}

/**
 * builds a frequency table from the given text
 *
 * @param text - the input text to analyze
 *
 * @returns a map with characters as keys and their frequencies as values
 *
 * @throws if text is not a string
 */
export function huffman_build_frequency_table(text: string): Map<string, number> {
   if (typeof text !== 'string') {
      throw new Error('input text must be a string');
   }

   const freq_table = new Map<string, number>();

   for (const ch of text) {
      freq_table.set(ch, (freq_table.get(ch) || 0) + 1);
   }

   return freq_table;
}

/**
 * builds the huffman tree from the input text
 *
 * @param text - the input string to encode
 *
 * @returns the root node of the huffman tree
 *
 * @throws if text is not provided or if no characters were found
 */
export function huffman_build_tree(text: string): HuffmanNode {
   if (typeof text !== 'string') {
      throw new Error('input text must be a string');
   }

   if (text.length === 0) {
      throw new Error('cannot build huffman tree for an empty string');
   }

   const freq_table = huffman_build_frequency_table(text);
   const nodes: HuffmanNode[] = [];

   if (freq_table.size === 0) {
      throw new Error('frequency table is empty, no valid characters found');
   }

   for (const [char, freq] of freq_table.entries()) {
      nodes.push({
         char,
         freq
      });
   }

   while (nodes.length > 1) {
      nodes.sort((a, b) => a.freq - b.freq);

      const left = nodes.shift();
      const right = nodes.shift();

      if (!(left && right)) {
         throw new Error('unexpected error building huffman tree: missing node');
      }

      const new_node: HuffmanNode = {
         freq: left.freq + right.freq,
         left,
         right
      };

      nodes.push(new_node);
   }

   const tree = nodes[0];

   if (!tree) {
      throw new Error('failed to build a valid huffman tree');
   }

   return tree;
}

/**
 * recursively generates the huffman codes for each character from the huffman tree
 *
 * @param node - the current node in the huffman tree
 * @param prefix - the prefix code built up to this node
 * @param code_map - a mapping of character to its code
 *
 * @returns a map from characters to their huffman codes
 *
 * @throws if the node is not defined
 */
export function huffman_generate_codes(
   node: HuffmanNode,
   prefix = '',
   code_map: Record<string, string> = {}
): Record<string, string> {
   if (!node) {
      throw new Error('invalid node provided to huffman_generate_codes');
   }

   // leaf node (has a character)
   if (node.char != null) {
      // in case the tree consists of only one node, assign a default code.
      code_map[node.char] = prefix || '0';
   } else {
      if (node.left) {
         huffman_generate_codes(node.left, `${prefix}0`, code_map);
      } else {
         throw new Error('invalid huffman tree: missing left child');
      }

      if (node.right) {
         huffman_generate_codes(node.right, `${prefix}1`, code_map);
      } else {
         throw new Error('invalid huffman tree: missing right child');
      }
   }

   return code_map;
}

/**
 * encodes a given text into a huffman encoded format
 *
 * @param text - the text to encode
 *
 * @returns the encoded data including the encoded 'ArrayBuffer', bit length, and huffman tree
 *
 * @throws if a character in the text has no corresponding huffman code
 */
export function huffman_encode(text: string): HuffmanEncoded {
   if (typeof text !== 'string') {
      throw new Error('input text must be a string');
   }

   if (text.length === 0) {
      return {
         encoded: new ArrayBuffer(0),
         bit_length: 0,
         tree: {
            freq: 0
         }
      };
   }

   const tree = huffman_build_tree(text);
   const codes = huffman_generate_codes(tree);

   const byte_array: number[] = [];

   let current_byte = 0;
   let bits_in_current = 0;
   let total_bits = 0;

   for (const ch of text) {
      const code = codes[ch];

      if (!code) {
         throw new Error(`no code found for character: ${ch}`);
      }

      for (const bit_char of code) {
         current_byte = (current_byte << 1) | (bit_char === '1' ? 1 : 0);
         bits_in_current++;
         total_bits++;

         if (bits_in_current === 8) {
            byte_array.push(current_byte);
            current_byte = 0;
            bits_in_current = 0;
         }
      }
   }

   // if the last byte is not complete
   if (bits_in_current > 0) {
      current_byte <<= 8 - bits_in_current;
      byte_array.push(current_byte);
   }

   const encoded = new Uint8Array(byte_array).buffer;

   return {
      encoded,
      bit_length: total_bits,
      tree
   };
}

/**
 * decodes a huffman encoded 'ArrayBuffer' back into the original text
 *
 * @param encoded - the encoded data
 * @param bit_length - the total number of valid bits in the encoded data
 * @param tree - the huffman tree used for decoding
 *
 * @returns the decoded text
 *
 * @throws if an invalid bit is encountered or if the inputs are not valid
 */
export function huffman_decode(
   encoded: ArrayBufferLike,
   bit_length: number,
   tree: HuffmanNode
): string {
   if (!(encoded instanceof ArrayBuffer)) {
      throw new Error('encoded data must be an ArrayBuffer');
   }

   if (typeof bit_length !== 'number' || bit_length < 0) {
      throw new Error('bit_length must be a non-negative number');
   }

   if (!tree) {
      throw new Error('a valid huffman tree is required for decoding');
   }

   let decoded = '';
   let current: HuffmanNode = tree;
   const data = new Uint8Array(encoded);

   for (let bit_index = 0; bit_index < bit_length; bit_index++) {
      const byte_index = Math.floor(bit_index / 8);
      const bit_pos = 7 - (bit_index % 8);
      const byte = data[byte_index]!;
      const bit = (byte >> bit_pos) & 1;

      if (bit === 0) {
         if (current.left) {
            current = current.left;
         } else {
            throw new Error('decoding error: missing left node in tree');
         }
      } else if (bit === 1) {
         if (current.right) {
            current = current.right;
         } else {
            throw new Error('decoding error: missing right node in tree');
         }
      } else {
         throw new Error(`invalid bit value encountered: ${bit}`);
      }

      if (current.char != null) {
         decoded += current.char;
         current = tree;
      }
   }

   return decoded;
}

/**
 * serializes the huffman tree into a 'Uint8Array'
 *
 * the tree is serialized using a pre-order traversal
 * a tag of 1 is written before a leaf node (followed by the character code),
 * while a tag of 0 is written before an internal node
 *
 * @param node - the huffman tree node to serialize
 *
 * @returns the serialized representation of the tree
 *
 * @throws if the provided node is invalid
 */
export function huffman_serialize_tree(node: HuffmanNode): Uint8Array {
   if (!node) {
      throw new Error('invalid huffman tree node provided for serialization');
   }

   const bytes: number[] = [];

   function traverse(n: HuffmanNode): void {
      if (n.char != null) {
         bytes.push(1);

         // assumes characters are represented as single-byte ascii
         bytes.push(n.char.charCodeAt(0));
      } else {
         bytes.push(0);

         if (n.left) {
            traverse(n.left);
         } else {
            throw new Error('invalid huffman tree: missing left child during serialization');
         }

         if (n.right) {
            traverse(n.right);
         } else {
            throw new Error('invalid huffman tree: missing right child during serialization');
         }
      }
   }

   traverse(node);

   return new Uint8Array(bytes);
}

/**
 * deserializes a huffman tree from a 'Uint8Array'
 *
 * @param data - the data containing the serialized tree
 * @param offset - the starting offset in the data to begin deserialization
 *
 * @returns an object containing the deserialized tree node and the number of bytes read
 *
 * @throws if the data is not long enough for deserialization
 */
export function huffman_deserialize_tree(
   data: Uint8Array,
   offset = 0
): {
   node: HuffmanNode;
   read: number;
} {
   if (!(data instanceof Uint8Array)) {
      throw new Error('data must be a Uint8Array');
   }

   if (offset < 0 || offset >= data.length) {
      throw new Error('invalid offset provided for deserialization');
   }

   let bytes_read = 1;
   const tag = data[offset];

   if (tag === 1) {
      if (offset + 1 >= data.length) {
         throw new Error('unexpected end of data when reading leaf node character');
      }

      const char_code = data[offset + 1]!;
      const node: HuffmanNode = {
         char: String.fromCharCode(char_code),
         freq: 0
      };

      bytes_read += 1;

      return {
         node,
         read: bytes_read
      };
   }

   if (tag === 0) {
      const left_result = huffman_deserialize_tree(data, offset + bytes_read);
      bytes_read += left_result.read;
      const right_result = huffman_deserialize_tree(data, offset + bytes_read);
      bytes_read += right_result.read;

      const node: HuffmanNode = {
         freq: 0,
         left: left_result.node,
         right: right_result.node
      };

      return {
         node,
         read: bytes_read
      };
   }

   throw new Error(`invalid tree tag encountered: ${tag}`);
}
