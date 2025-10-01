/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/ecs/resources/core.ts
 */

import { SparseSet } from '@eldritch-engine/utils/std/sparse_set';

import type { EntityId } from '@self/types/entity';
import type { Component } from '@self/types/component';
import { Resource } from '@self/types/resource';
import type { System } from '@self/types/system';

export class ResourceEntitiesDeleted extends Resource {
   data: SparseSet = new SparseSet();
}

export class ResourceComponentEntities extends Resource {
   data: Map<string, SparseSet> = new Map();
}

export class ResourceComponentLastWriteTick extends Resource {
   data: Map<string, number> = new Map();
}

export class ResourceComponentUpdates extends Resource {
   data: Map<string, Map<EntityId, Component>> = new Map();
}

export class ResourceCheckDependsComponent extends Resource {
   data: Map<string, Set<string>> = new Map();
}

export class ResourceCheckDependsSystem extends Resource {
   data: Map<string, Set<string>> = new Map();
}

export class ResourceSystemLastWriteTick extends Resource {
   // TODO: make this string and use prototype ???
   data: Map<System, number> = new Map();
}

export class ResourceWorldTick extends Resource {
   data: number = 0;
}

export class ResourceDeltaTimeLogical extends Resource {
   data: number = -1;
}

export class ResourceDeltaTimeLogicalReal extends Resource {
   data: number = -1;
}

export class ResourceDeltaTimeRender extends Resource {
   data: number = -1;
}

export class ResourceDeltaTimeRenderReal extends Resource {
   data: number = -1;
}