/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/ecs/components/grouping/group_members.ts
 */

import type { sparseset, t } from '@eldritch-engine/type-utils/guerrero/markers';
import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

import { RelationshipTargetBase } from '@self/types/relationship';

@Reflectable()
export class ComponentGroupMembers extends RelationshipTargetBase {
   /** list of entity ids that are members of this logical group */
   source_entities!: t<sparseset>;
}