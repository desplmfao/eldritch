/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/input/input-core/src/ecs/resources/input_adapter_handle.ts
 */

import { Resource } from '@eldritch-engine/ecs-core/types/resource';

import type { InputAdapter } from '@self/types/adapter';

/**
 * resource holding the currently active InputAdapter instance.
 * 
 * the platform-specific input plugin is responsible for creating and setting the adapter instance here. 
 * 
 * the core input system queries this resource to get events from the adapter.
 */
export class ResourceInputAdapterHandle extends Resource {
   adapter?: InputAdapter;
}