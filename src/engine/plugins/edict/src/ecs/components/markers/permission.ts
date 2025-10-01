/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/components/markers/permission.ts
 */

import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

import { ComponentTag } from '@eldritch-engine/ecs-core/ecs/components/collaring/tag';

/** a marker component to be extended off of */
@Reflectable()
export class ComponentPermission extends ComponentTag {
}