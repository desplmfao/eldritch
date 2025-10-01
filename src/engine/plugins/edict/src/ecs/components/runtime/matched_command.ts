/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/components/runtime/matched_command.ts
 */

import type { str, t } from '@eldritch-engine/type-utils/guerrero/markers';
import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

import { Component } from '@eldritch-engine/ecs-core/types/component';
import { entity_id_none, type EntityId } from '@eldritch-engine/ecs-core/types/entity';

/** a transient component indicating a command string has been successfully matched to a command definition */
@Reflectable()
export class ComponentMatchedCommand extends Component {
   /** */
   sender_entity_id: EntityId = entity_id_none;

   /** */
   matched_command_entity_id: EntityId = entity_id_none;

   /** the remaining part of the raw command string, expected to contain the arguments */
   remaining_args!: t<str[]>;
}