/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/filesystem/src/types/filesystem.ts
 */

export interface Stat {
   size: number;
   mode: number;
   create_time: number;
   change_time: number;
   modify_time: number;
}

export enum MetadataType {
   Data = 0,
   File = 1,
   Folder = 2
}

export type ObjectId = string | number;

export interface Metadata {
   type: MetadataType;
}

export interface FileStat {
   stat: Stat;
   size: number;
   huffman_size?: number;
}

export interface FileMetadata extends Metadata, FileStat {
   type: MetadataType.File;
   chunks: ObjectId[];
}

export interface Entry {
   name: string;
   type: MetadataType.File | MetadataType.Folder;
   object_id: ObjectId;
}

export interface FolderMetadata extends Metadata, FileStat {
   type: MetadataType.Folder;
   entries: Entry[];
}

export interface ObjectRaw<T> {
   metadata: T;
   data?: Uint8Array;
}

export interface FileSystem {
   /** read the contents of a directory */
   readdir(path: string): Promise<string[]>;

   /** removes a directory at the given path */
   rmdir(path: string): Promise<boolean>;

   /** creates a new directory */
   mkdir(
      path: string,
      options?: {
         recursive?: boolean;
      }
   ): Promise<boolean>;

   /**
    * reads the entire file at the given path
    *
    * @returns the file's content as an 'ArrayBuffer'
    */
   read(path: string): Promise<Uint8Array>;

   /** writes data to a file */
   write(
      path: string,
      buffer: Uint8Array,
      /** only for non-native platforms */
      use_huffman?: boolean
   ): Promise<boolean>;

   /** renames a file or directory */
   rename(old_path: string, new_path: string): Promise<boolean>;

   /**
    * changes the permissions of a file or directory
    *
    * @param mode – the new permissions expressed as a string or number
    */
   chmod(path: string, mode: string | number): Promise<boolean>;

   /** reads file statistics for a given path */
   stat(path: string): Promise<Stat>;

   /** if the path exists */
   exists(path: string): Promise<boolean>;
}
