declare module "mysql2/promise" {

import type { EventEmitter } from "events"
import type {
  ConnectionOptions,
  FieldInfo as FieldPacket,
  OkPacket,
  QueryOptions,
} from "mysql"
export type * from "mysql"

//

// tslint:disable-next-line: interface-name
export interface RowDataPacket {
  constructor: {
    name: "RowDataPacket",
  }
  [column: string]: any
  [column: number]: any
}

// tslint:disable-next-line: interface-name
export interface Connection extends EventEmitter {

  config: ConnectionOptions
  threadId: number

  connect(): Promise<void>

  beginTransaction(): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>

  changeUser(options: ConnectionOptions): Promise<void>

  query<T extends RowDataPacket[][] | RowDataPacket[] | OkPacket | OkPacket[]>(sql: string): Promise<[T, FieldPacket[]]>
  // tslint:disable-next-line: unified-signatures
  query<T extends RowDataPacket[][] | RowDataPacket[] | OkPacket | OkPacket[]>(sql: string, values: any | any[] | { [param: string]: any }): Promise<[T, FieldPacket[]]>
  // tslint:disable-next-line: unified-signatures
  query<T extends RowDataPacket[][] | RowDataPacket[] | OkPacket | OkPacket[]>(options: QueryOptions): Promise<[T, FieldPacket[]]>
  // tslint:disable-next-line: unified-signatures
  query<T extends RowDataPacket[][] | RowDataPacket[] | OkPacket | OkPacket[]>(options: QueryOptions, values: any | any[] | { [param: string]: any }): Promise<[T, FieldPacket[]]>

  execute<T extends RowDataPacket[][] | RowDataPacket[] | OkPacket | OkPacket[]>(sql: string): Promise<[T, FieldPacket[]]>
  // tslint:disable-next-line: unified-signatures
  execute<T extends RowDataPacket[][] | RowDataPacket[] | OkPacket | OkPacket[]>(sql: string, values: any | any[] | { [param: string]: any }): Promise<[T, FieldPacket[]]>
  // tslint:disable-next-line: unified-signatures
  execute<T extends RowDataPacket[][] | RowDataPacket[] | OkPacket | OkPacket[]>(options: QueryOptions): Promise<[T, FieldPacket[]]>
  // tslint:disable-next-line: unified-signatures
  execute<T extends RowDataPacket[][] | RowDataPacket[] | OkPacket | OkPacket[]>(options: QueryOptions, values: any | any[] | { [param: string]: any }): Promise<[T, FieldPacket[]]>

  end(options?: any): Promise<void>

  destroy(): void

  pause(): void

  resume(): void

  escape(value: any): string

  escapeId(value: string): string
  // tslint:disable-next-line: unified-signatures
  escapeId(values: string[]): string

  format(sql: string, values?: any | any[] | { [param: string]: any }): string

}

export function createConnection(config: string|ConnectionOptions): Promise<Connection>

}