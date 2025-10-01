/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/filesystem/src/platform/browser/indexeddb.ts
 */

import { compress_data, decompress_data } from '@self/huffman_compression';

import type {
   FileSystem,
   Stat,
   FileMetadata,
   FolderMetadata,
   Entry,
   ObjectRaw,
   ObjectId,
   Metadata
} from '@self/types/filesystem';

import { MetadataType } from '@self/types/filesystem';

class FileSystemError extends Error {
   constructor(message: string, original_error?: Error) {
      const full_message = original_error ? `${message}: ${original_error.message}` : message;

      super(full_message);

      this.name = 'FileSystemError';
   }
}

class FileNotFoundError extends FileSystemError {
   constructor(path: string, original_error?: Error) {
      super(`file not found: ${path}`, original_error);

      this.name = 'FileNotFoundError';
   }
}

class DirectoryNotEmptyError extends FileSystemError {
   constructor(path: string) {
      super(`directory not empty: ${path}`);

      this.name = 'DirectoryNotEmptyError';
   }
}

class EntryNotFoundError extends FileSystemError {
   constructor(key: string) {
      super(`entry not found for key: ${key}`);

      this.name = 'EntryNotFoundError';
   }
}

const CHUNK_SIZE = 128 * 1024; // 128kb chunk size

const PREFIX = 'fs';

// use separate key prefixes for folders and files
const DIR_PREFIX = `${PREFIX}:${MetadataType.Folder}:`;
const FILE_PREFIX = `${PREFIX}:${MetadataType.File}:`;
const CHUNK_PREFIX = `${PREFIX}:${MetadataType.Data}:`;
const NEXT_ID_KEY = `${PREFIX}:next`;

const MAGIC_DATA = 0x01;
const MAGIC_JSON = 0x02;

// helper to build the storage key for a folder
function get_dir_key(
   path: string
): string {
   if (!path.startsWith('/')) {
      path = `/${path}`;
   }

   return DIR_PREFIX + path;
}

// helper to build the storage key for a file
function get_file_key(
   path: string
): string {
   if (!path.startsWith('/')) {
      path = `/${path}`;
   }

   return FILE_PREFIX + path;
}

function get_chunk_key(chunk_id: ObjectId): string {
   return `${CHUNK_PREFIX}${chunk_id}`;
}

// helper to split a path into parent and file/folder name
function split_path(
   path: string
): {
   parent: string;
   name: string;
} {
   if (!path.startsWith('/')) {
      path = `/${path}`;
   }

   const segments = path.split('/').filter((seg) => seg.length > 0);
   const name = segments.pop() || '';
   const parent = `/${segments.join('/')}`;

   return {
      parent: parent === '//' ? '/' : parent,
      name
   };
}

// helper: create a new stat with current timestamp
function create_stat(
   size: number = 0
): Stat {
   const now = Date.now();

   return {
      size,
      mode: 0,
      create_time: now,
      change_time: now,
      modify_time: now
   };
}

export class IndexedDBFileSystem implements FileSystem {
   // promise that resolves with the opened indexeddb connection
   #db_promise: Promise<IDBDatabase>;
   // counter for generating purely numeric object ids
   #next_object_id = 1;

   #init_complete: Promise<void>;

   constructor(
      filesystem_id: string
   ) {
      // open (or create) the indexeddb database
      this.#db_promise = new Promise((resolve, reject) => {
         const request = indexedDB.open(filesystem_id, 1);

         request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains('metadata')) {
               db.createObjectStore('metadata');
            }

            if (!db.objectStoreNames.contains('data')) {
               db.createObjectStore('data');
            }
         };

         request.onsuccess = () => {
            resolve(request.result);
         };

         request.onerror = () => {
            reject(request.error);
         };
      });

      // ensure the root directory exists
      this.#init_complete = (async () => {
         await this.#init_root();
         await this.#init_next_id();
      })();
   }

   async readdir(
      path: string
   ): Promise<string[]> {
      const folder = await this.#get_folder<FolderMetadata>(path);

      return folder.entries.map((entry) => entry.name);
   }

   async rmdir(
      path: string
   ): Promise<boolean> {
      const folder = await this.#get_folder<FolderMetadata>(path);

      if (folder.entries.length > 0) {
         throw new DirectoryNotEmptyError(path);
      }

      await this.#delete_record(get_dir_key(path));

      const { parent, name } = split_path(path);

      if (parent) {
         const parent_folder = await this.#get_folder<FolderMetadata>(parent);

         parent_folder.entries = parent_folder.entries.filter((entry) => entry.name !== name);

         await this.#put_record(get_dir_key(parent), parent_folder);
      }

      return true;
   }

   async mkdir(
      path: string,
      options?: {
         recursive?: boolean;
      }
   ): Promise<boolean> {
      const segments = path.split('/').filter((seg) => seg.length > 0);

      if (options?.recursive) {
         let current = '/';

         for (const seg of segments) {
            const new_path = current === '/' ? `/${seg}` : `${current}/${seg}`;
            let exists = false;

            try {
               await this.#get_folder(new_path);
               exists = true;
            } catch (e) {
               exists = false;
            }

            if (!exists) {
               const folder: FolderMetadata = {
                  type: MetadataType.Folder,
                  entries: [],
                  stat: create_stat(0),
                  size: 0
               };

               await this.#put_record(get_dir_key(new_path), folder);
            }

            current = new_path;
         }
      } else {
         const parent_segments = segments.slice(0, segments.length - 1);

         let parent_path = '/';

         for (const seg of parent_segments) {
            const new_path = parent_path === '/' ? `/${seg}` : `${parent_path}/${seg}`;

            try {
               await this.#get_folder(new_path);
            } catch (e) {
               throw new Error(`mkdir: parent directory ${new_path} does not exist`);
            }

            parent_path = new_path;
         }

         const final_path = `/${segments.join('/')}`;

         try {
            await this.#get_folder(final_path);
         } catch (e) {
            const folder: FolderMetadata = {
               type: MetadataType.Folder,
               entries: [],
               stat: create_stat(0),
               size: 0
            };

            await this.#put_record(get_dir_key(final_path), folder);
         }
      }

      return true;
   }

   async read(
      path: string
   ): Promise<Uint8Array> {
      const file_record = await this.#get_record<ObjectRaw<FileMetadata>>(get_file_key(path));

      if (!file_record) {
         throw new FileNotFoundError(path);
      }

      const file_metadata = file_record.metadata;
      const total_size =
         typeof file_metadata.huffman_size === 'number'
            ? file_metadata.huffman_size
            : file_metadata.size;
      const chunks: Uint8Array[] = [];

      for (const chunk_id of file_metadata.chunks) {
         const chunk = await this.#get_record<Uint8Array>(get_chunk_key(chunk_id));

         if (!chunk) {
            throw new Error(`missing chunk data for chunk id ${chunk_id}`);
         }

         chunks.push(chunk);
      }

      const combined = new Uint8Array(total_size);

      let offset = 0;

      for (const chunk of chunks) {
         combined.set(chunk, offset);

         offset += chunk.length;
      }

      return file_metadata.huffman_size
         ? new Uint8Array(decompress_data(combined.buffer))
         : combined;
   }

   async write(
      path: string,
      buffer: Uint8Array,
      // huffman breaks if its stacked on eachother with multiple huffmans
      use_huffman = false
   ): Promise<boolean> {
      const { parent, name } = split_path(path);
      let file_id: ObjectId;

      if (parent) {
         // await this.mkdir(parent);

         const parent_folder = await this.#get_folder<FolderMetadata>(parent);
         const existing_entry = parent_folder.entries.find((entry) => {
            return entry.name === name && entry.type === MetadataType.File;
         });

         if (existing_entry) {
            file_id = existing_entry.object_id;
         } else {
            file_id = await this.#generate_object_id();

            parent_folder.entries.push({
               name: name,
               type: MetadataType.File,
               object_id: file_id
            });

            await this.#put_record(get_dir_key(parent), parent_folder);
         }
      } else {
         file_id = await this.#generate_object_id();
      }

      // if a file already exists at this path, remove its old chunks so that the new content replaces them
      try {
         const old_record = await this.#get_record<ObjectRaw<FileMetadata>>(get_file_key(path));

         if (old_record?.metadata?.chunks) {
            for (const old_chunk_id of old_record.metadata.chunks) {
               await this.#delete_record(get_chunk_key(old_chunk_id));
            }
         }
      } catch (e) {
         // if no old record exists, nothing to delete
      }

      const raw_size = buffer.byteLength;

      const buf = use_huffman ? new Uint8Array(compress_data(buffer.buffer)) : buffer;
      const huffman_size = use_huffman ? buf.buffer.byteLength : undefined;
      const total_size = buf.byteLength; // huffman
      const chunk_ids: ObjectId[] = [];

      for (let offset = 0; offset < total_size; offset += CHUNK_SIZE) {
         const chunk = buf.slice(offset, Math.min(offset + CHUNK_SIZE, total_size));
         const chunk_id = await this.#generate_object_id();

         chunk_ids.push(chunk_id);

         await this.#put_record(get_chunk_key(chunk_id), chunk);
      }

      const file_metadata: FileMetadata = {
         type: MetadataType.File,
         stat: create_stat(raw_size),
         chunks: chunk_ids,
         size: raw_size,
         huffman_size: huffman_size
      };

      // store the file metadata record (the data field is null)
      const file_record: ObjectRaw<FileMetadata> = {
         metadata: file_metadata
      };

      await this.#put_record(get_file_key(path), file_record);

      return true;
   }

   async rename(
      old_path: string,
      new_path: string
   ): Promise<boolean> {
      if (await this.exists(new_path)) {
         throw new FileSystemError(`cannot rename: destination ${new_path} already exists`);
      }

      const file_source_key = get_file_key(old_path);
      const file_dest_key = get_file_key(new_path);

      let record = await this.#get_record(file_source_key);

      if (record) {
         await this.#put_record(file_dest_key, record);
         await this.#delete_record(file_source_key);

         return true;
      }

      const folder_source_key = get_dir_key(old_path);
      const folder_dest_key = get_dir_key(new_path);

      record = await this.#get_record(folder_source_key);

      if (record) {
         await this.#put_record(folder_dest_key, record);
         await this.#delete_record(folder_source_key);
         await this.#rename_children(old_path, new_path);

         return true;
      }

      throw new FileSystemError(`source path ${old_path} does not exist`);
   }

   async chmod(
      path: string,
      mode: string | number
   ): Promise<boolean> {
      let key = '';

      try {
         await this.#get_record<FolderMetadata>(get_dir_key(path));
         key = get_dir_key(path);

         const folder = await this.#get_record<FolderMetadata>(key);
         folder.stat.mode = typeof mode === 'number' ? mode : Number.parseInt(mode as string, 10);

         await this.#put_record(key, folder);
      } catch (e) {
         try {
            await this.#get_record<ObjectRaw<FileMetadata>>(get_file_key(path));
            key = get_file_key(path);

            const record = await this.#get_record<ObjectRaw<FileMetadata>>(key);
            record.metadata.stat.mode =
               typeof mode === 'number' ? mode : Number.parseInt(mode as string, 10);

            await this.#put_record(key, record);
         } catch (e2) {
            throw new EntryNotFoundError(path);
         }
      }

      return true;
   }

   async stat(
      path: string
   ): Promise<Stat> {
      try {
         const folder = await this.#get_record<FolderMetadata>(get_dir_key(path));

         return folder.stat;
      } catch (e) {
         try {
            const record = await this.#get_record<ObjectRaw<FileMetadata>>(get_file_key(path));

            return record.metadata.stat;
         } catch (e2) {
            throw new EntryNotFoundError(path);
         }
      }
   }

   async exists(
      path: string
   ): Promise<boolean> {
      try {
         // try as file
         await this.#get_file(path);

         return true;
      } catch (e) {
         // not a file, try as folder
      }

      try {
         await this.#get_folder(path);

         return true;
      } catch (e) {
         return false;
      }
   }

   async #init_root(

   ): Promise<void> {
      try {
         await this.#get_folder('/');
      } catch (e) {
         const root: FolderMetadata = {
            type: MetadataType.Folder,
            entries: [] as Entry[],
            stat: create_stat(0),
            size: 0
         };

         await this.#put_record(get_dir_key('/'), root);
      }
   }

   async #init_next_id(

   ): Promise<void> {
      await this.#db_promise;

      const store = await this.#get_store('metadata', 'readonly');

      const stored = await new Promise((resolve, reject) => {
         const request = store.get(NEXT_ID_KEY);

         request.onsuccess = () => resolve(request.result);
         request.onerror = () => reject(request.error);
      });

      if (stored != null && !Number.isNaN(Number(stored))) {
         this.#next_object_id = Number(stored);
      } else {
         this.#next_object_id = 1;

         await this.#put_record(NEXT_ID_KEY, 1);
      }
   }

   async #get_store(
      store_name: 'data' | 'metadata',
      mode: IDBTransactionMode
   ): Promise<IDBObjectStore> {
      const db = await this.#db_promise;

      return db.transaction(store_name, mode).objectStore(store_name);
   }

   #determine_store(
      key: string
   ): 'data' | 'metadata' {
      if (key === NEXT_ID_KEY || key.startsWith(DIR_PREFIX) || key.startsWith(FILE_PREFIX)) {
         return 'metadata';
      }

      if (key.startsWith(CHUNK_PREFIX)) {
         return 'data';
      }

      return 'metadata';
   }

   async #get_record<T>(
      key: string
   ): Promise<T> {
      const store_name = this.#determine_store(key);
      const store = await this.#get_store(store_name, 'readonly');

      return new Promise<T>((resolve, reject) => {
         const request = store.get(key);

         request.onsuccess = () => {
            const result = request.result;

            if (result == null) {
               resolve(undefined as T);
            } else {
               try {
                  const deserialized = this.#deserialize_value<T>(result);

                  resolve(deserialized);
               } catch (e) {
                  reject(e);
               }
            }
         };
         request.onerror = () => reject(request.error);
      });
   }

   async #put_record<T>(
      key: string,
      value: T
   ): Promise<IDBValidKey> {
      const store_name = this.#determine_store(key);
      const store = await this.#get_store(store_name, 'readwrite');
      const data = this.#serialize_value(value);

      return new Promise((resolve, reject) => {
         const request = store.put(data, key);

         request.onsuccess = () => resolve(request.result);
         request.onerror = () => reject(request.error);
      });
   }

   async #delete_record(
      key: string
   ): Promise<void> {
      const store_name = this.#determine_store(key);
      const store = await this.#get_store(store_name, 'readwrite');

      return new Promise((resolve, reject) => {
         const request = store.delete(key);

         request.onsuccess = () => resolve(request.result);
         request.onerror = () => reject(request.error);
      });
   }

   async #get_all_keys(

   ): Promise<string[]> {
      const db = await this.#db_promise;

      return new Promise((resolve, reject) => {
         const tx = db.transaction('items', 'readonly');
         const store = tx.objectStore('items');
         const request = store.getAllKeys();

         request.onsuccess = () => resolve(request.result as string[]);
         request.onerror = () => reject(request.error);
      });
   }

   async #get_file<T extends Metadata>(
      path: string
   ): Promise<T> {
      const folder = await this.#get_record<T>(get_file_key(path));

      if (!folder || folder.type !== MetadataType.File) {
         throw new Error('not a file');
      }

      return folder;
   }

   async #get_folder<T extends Metadata>(
      path: string
   ): Promise<T> {
      const folder = await this.#get_record<T>(get_dir_key(path));

      if (!folder || folder.type !== MetadataType.Folder) {
         throw new Error('not a directory');
      }

      return folder;
   }

   async #rename_children(
      old_path: string,
      new_path: string
   ): Promise<void> {
      const store = await this.#get_store('metadata', 'readwrite');

      return new Promise((resolve, reject) => {
         const cursor_request = store.openCursor();

         cursor_request.onerror = () =>
            reject(new FileSystemError('failed to open cursor', cursor_request.error as Error));

         cursor_request.onsuccess = () => {
            const cursor = cursor_request.result;

            if (cursor) {
               let actual_path = '';

               const key = cursor.key as string;

               if (key.startsWith(DIR_PREFIX)) {
                  actual_path = key.substring(DIR_PREFIX.length);
               } else if (key.startsWith(FILE_PREFIX)) {
                  actual_path = key.substring(FILE_PREFIX.length);
               } else {
                  cursor.continue();

                  return;
               }

               if (actual_path.startsWith(old_path)) {
                  let new_key = '';

                  const new_actual = new_path + actual_path.substring(old_path.length);

                  if (key.startsWith(DIR_PREFIX)) {
                     new_key = get_dir_key(new_actual);
                  } else if (key.startsWith(FILE_PREFIX)) {
                     new_key = get_file_key(new_actual);
                  }

                  const value = cursor.value;

                  const delete_request = cursor.delete();

                  delete_request.onerror = () =>
                     reject(
                        new FileSystemError(
                           'failed to delete old record during rename',
                           delete_request.error as Error
                        )
                     );

                  delete_request.onsuccess = () => {
                     const put_request = store.put(value, new_key);

                     put_request.onerror = () =>
                        reject(
                           new FileSystemError(
                              'failed to add record during rename',
                              put_request.error as Error
                           )
                        );
                     put_request.onsuccess = () => {
                        cursor.continue();
                     };
                  };
               } else {
                  cursor.continue();
               }
            } else {
               resolve();
            }
         };
      });
   }

   /** helper: generate a new (purely numeric) object id */
   async #generate_object_id(

   ): Promise<number> {
      await this.#init_complete;

      const current_id = this.#next_object_id;
      this.#next_object_id++;

      return current_id;
   }

   #serialize_value(
      value: unknown
   ): Uint8Array {
      if (value instanceof Uint8Array) {
         const result = new Uint8Array(value.length + 1);

         result[0] = MAGIC_DATA;
         result.set(value, 1);

         return result;
      }

      const json_str = JSON.stringify(value);
      const encoded = new TextEncoder().encode(json_str);
      const result = new Uint8Array(encoded.length + 1);

      result[0] = MAGIC_JSON;
      result.set(encoded, 1);

      return result;
   }

   #deserialize_value<T>(
      data: Uint8Array
   ): T {
      if (data.length === 0) {
         throw new Error('invalid stored data');
      }

      const type_flag = data[0];

      if (type_flag === MAGIC_DATA) {
         return data.slice(1) as unknown as T;
      }

      if (type_flag === MAGIC_JSON) {
         const json_str = new TextDecoder().decode(data.slice(1));

         return JSON.parse(json_str);
      }

      throw new Error('unknown data format');
   }
}
