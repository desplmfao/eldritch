/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/filesystem/src/index.ts
 */

/// #if PLATFORM_SUPPORT === 'bun'
import { NodeFileSystem } from '@self/platform/node';
/// #endif

import { IndexedDBFileSystem } from '@self/platform/browser/indexeddb';

import type { FileSystem } from '@self/types/filesystem';

//
//
//

export function encode_text(text: string): Uint8Array {
   return new Uint8Array(new TextEncoder().encode(text).buffer);
}

export function decode_text(buffer: Uint8Array): string {
   return new TextDecoder().decode(buffer);
}
//
//
//

let fs_impl: FileSystem;

if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
   fs_impl = new IndexedDBFileSystem('fs');
} else if (
   typeof process !== 'undefined' &&
   process.versions != null &&
   process.versions.node != null
) {
   /// #if PLATFORM_SUPPORT === 'bun'
   fs_impl = new NodeFileSystem('./assets'); // probably fine
   /// #endif
} else {
   throw new Error('no supported environment found');
}

/** auto */
export const fs = fs_impl;

// for debugging
if (typeof window !== 'undefined') {
   // @ts-expect-error
   window.fs = fs;
}
