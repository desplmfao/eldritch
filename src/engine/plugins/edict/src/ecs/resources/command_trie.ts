/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/resources/command_trie.ts
 */

import type { map, str, t } from '@eldritch-engine/type-utils/guerrero/markers';
import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

import { Resource } from '@eldritch-engine/ecs-core/types/resource';
import { entity_id_none, type EntityId } from '@eldritch-engine/ecs-core/types/entity';

@Reflectable()
export class CommandTrieNode {
   /** children nodes, keyed by the next word in a command path */
   children!: t<map<str, CommandTrieNode>>;

   /** the entity id of the command if this node represents the end of a valid command path */
   entity_id?: EntityId = entity_id_none;
}

/** a resource holding the root of a Trie for fast command matching */
@Reflectable()
export class ResourceCommandTrie extends Resource {
   /** */
   root!: t<CommandTrieNode>;
}