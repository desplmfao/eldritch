/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/assets/assets-core-edppf/src/loader.ts
 */

import type { IAssetLoader, AssetLoaderContext } from '@eldritch-engine/plugin-assets-core/types/loader';
import { EDPPFAsset, type OperationEntry } from '@self/types/index';

const EDPPF_MAGIC = 0x46504445; // EDPF

export class EDPPFLoader implements IAssetLoader<EDPPFAsset> {
   readonly extensions = new Set(['.edppf']);

   async load(bytes: ArrayBuffer, context: AssetLoaderContext): Promise<EDPPFAsset> {
      const view = new DataView(bytes);

      if (view.getUint32(0, false) !== EDPPF_MAGIC) {
         throw new Error('invalid edppf file: incorrect magic number');
      }

      const version = view.getUint32(4, true);
      const operation_count = view.getUint32(8, true);
      const payload_pool_size = view.getUint32(12, true);

      const header_size = 16;
      const op_table_size = operation_count * 24;
      const payload_offset = header_size + op_table_size;

      const operations: OperationEntry[] = [];

      for (let i = 0; i < operation_count; i++) {
         const op_offset = header_size + (i * 24);

         const entry: OperationEntry = {
            condition_id: view.getUint32(op_offset + 0, true),
            target_selector: view.getUint8(op_offset + 4),
            //
            ebnp_message_type_id: view.getUint16(op_offset + 8, true),
            ebnp_flags: view.getUint16(op_offset + 10, true),
            ebnp_payload_schema_id: view.getUint32(op_offset + 12, true),
            ebnp_payload_offset: view.getUint32(op_offset + 16, true),
            ebnp_payload_size: view.getUint32(op_offset + 20, true),
         };

         operations.push(entry);
      }

      const payload_pool = bytes.slice(payload_offset, payload_offset + payload_pool_size);

      return new EDPPFAsset(operations, payload_pool);
   }
}