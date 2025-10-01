/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/assets/assets-core-edppf/src/types/index.ts
 */

import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';
import type { Component } from '@eldritch-engine/ecs-core/types/component';

import { Asset, type Handle } from '@eldritch-engine/plugin-assets-core/types/asset';

export class Prefab extends Asset { }

/** describes a deferred command to spawn an entity from a prefab */
export interface PrefabSpawnCommand {
   handle: Handle<Prefab>;
   parent?: EntityId;
   components?: Component[];
}

/** enum defining the dispatch target for a prefab operation's packet */
export enum TargetSelector {
   Self = 0x01,
   Root = 0x02,
   Player = 0x03,
   World = 0x04,
   Server = 0x05,
}

/** represents a single conditional operation within an edppf file */
export interface OperationEntry {
   condition_id: number;
   target_selector: TargetSelector;
   //
   ebnp_message_type_id: number;
   ebnp_flags: number;
   ebnp_payload_schema_id: number;
   ebnp_payload_offset: number;
   ebnp_payload_size: number;
}

/**
 * a runtime representation of a loaded edppf file
 * 
 * it contains the parsed operations and the raw payload data, ready for the edppf executor
 */
export class EDPPFAsset extends Asset {
   readonly operations: OperationEntry[];
   readonly payload_pool: ArrayBufferLike;

   constructor(
      operations: OperationEntry[],
      payload_pool: ArrayBufferLike
   ) {
      super();

      this.operations = operations;
      this.payload_pool = payload_pool;
   }
}