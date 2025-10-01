/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/resources/command_feedback.ts
 */

import type { str, t } from '@eldritch-engine/type-utils/guerrero/markers';
import { Reflectable, ReflectProperty } from '@eldritch-engine/guerrero-core/reflect/decorators';

import { entity_id_none, type EntityId } from '@eldritch-engine/ecs-core/types/entity';
import { Resource } from '@eldritch-engine/ecs-core/types/resource';

export enum FeedbackLevel {
   Info,
   Success,
   Warning,
   Error,
}

@Reflectable()
export class CommandFeedback {
   /** */
   recipient_entity_id: EntityId = entity_id_none;

   /** */
   message: t<str> = '';

   /** */
   level: FeedbackLevel = FeedbackLevel.Info;
}

/** a resource that holds a queue of feedback messages for command senders */
@Reflectable()
export class ResourceCommandFeedback extends Resource {
   /** */
   queue!: CommandFeedback[];
}