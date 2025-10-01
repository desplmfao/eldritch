/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/components/validation/string_length.ts
 */

import type { t, u32 } from '@eldritch-engine/type-utils/guerrero/markers';
import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

import { Component } from '@eldritch-engine/ecs-core/types/component';

/**
 * a validation component that constrains a string argument to a specific length range
 * 
 * attach this to an argument node that uses a string parser
 */
@Reflectable()
export class ComponentStringLength extends Component {
   /** the minimum allowed length (inclusive) */
   min?: t<u32>;

   /** the maximum allowed length (inclusive) */
   max?: t<u32>;
}