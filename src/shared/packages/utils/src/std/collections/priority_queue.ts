/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/utils/src/std/collections/priority_queue.ts
 */

export interface PriorityQueueNode<T> {
   priority: number;
   value: T;
}

export class PriorityQueue<T> {
   #heap: PriorityQueueNode<T>[] = [];

   get size(): number {
      return this.#heap.length;
   }

   enqueue(value: T, priority: number): void {
      this.#heap.push({
         value,
         priority
      });

      this.#bubble_up(this.#heap.length - 1);
   }

   dequeue(): T | undefined {
      if (this.size === 0) {
         return;
      }

      this.#swap(0, this.size - 1);
      const { value } = this.#heap.pop()!;

      if (this.size > 0) {
         this.#sink_down(0);
      }

      return value;
   }

   peek(): T | undefined {
      return this.#heap[0]?.value;
   }

   #bubble_up(index: number): void {
      while (index > 0) {
         const parent_index = Math.floor((index - 1) / 2);

         if (this.#heap[parent_index]!.priority <= this.#heap[index]!.priority) {
            break;
         }

         this.#swap(index, parent_index);

         index = parent_index;
      }
   }

   #sink_down(index: number): void {
      while (true) {
         let smallest = index;

         const left = 2 * index + 1;
         const right = 2 * index + 2;

         if (
            left < this.size
            && this.#heap[left]!.priority < this.#heap[smallest]!.priority
         ) {
            smallest = left;
         }

         if (
            right < this.size
            && this.#heap[right]!.priority < this.#heap[smallest]!.priority
         ) {
            smallest = right;
         }

         if (smallest === index) break;
         this.#swap(index, smallest);
         index = smallest;
      }
   }

   #swap(i: number, j: number): void {
      [this.#heap[i], this.#heap[j]] = [this.#heap[j]!, this.#heap[i]!];
   }
}