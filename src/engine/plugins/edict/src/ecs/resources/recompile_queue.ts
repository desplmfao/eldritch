/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/resources/recompile_queue.ts
 */

import type { set, t } from '@eldritch-engine/type-utils/guerrero/markers';

import { Resource } from '@eldritch-engine/ecs-core/types/resource';
import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';

/** a resource that holds a queue of command graph entities that need to be recompiled */
export class ResourceRecompileQueue extends Resource {
   /** */
   entities!: t<set<EntityId>>;
}