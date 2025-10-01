/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/components/optional.ts
 */

import type { bool, f64, str, t } from '@eldritch-engine/type-utils/guerrero/markers';
import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

import { Component } from '@eldritch-engine/ecs-core/types/component'

/**
 * a component that marks a command argument node as optional
 * 
 * if the user does not provide a value for this argument, the command can still be executed using the `default_value`
 *
 * @remarks only trailing arguments in a command path should be marked as optional
 */
@Reflectable()
export class ComponentOptional extends Component {
   /** the default value to use if this optional argument is not provided by the user */
   default_value!: t<str | f64 | bool>;
}