
import * as mysql from "mysql"
import * as mysqlAsync from "mysql2/promise"
import { Transform } from "stream"

import {
  DbConnection,
  DbErrorResult,
  DbResult,
  DbRow,
  IMyDb,
  MyAsyncGenerator,
  NewRowRes,
  NextRequest,
} from "@emmveqz/currency-reports-core-interfaces"
import Utils from "@emmveqz/currency-reports-tools/dist/Utils"

type RowDataPacket = mysqlAsync.RowDataPacket
type CmdResult = RowDataPacket[][]|mysql.OkPacket

export default class MyDb implements IMyDb {
  public static readonly STREAM_BUFFER_SIZE = 12
  public selectedSchema: string
  private connOptions: mysql.ConnectionConfig

  constructor({ Database, Host, Pass, User }: DbConnection) {
    this.selectedSchema = Database
    this.connOptions = { database: Database, dateStrings: true, host: Host, password: Pass, user: User }
  }

  public ChangeConn({ Database, Host, Pass, User }: DbConnection): this {
    this.connOptions = { database: Database, dateStrings: true, host: Host, password: Pass, user: User }
    return this
  }

  public async Get(queryBuilder: string|Error): Promise<DbResult<DbRow | null>> {
    const res = await this.executeCmd<RowDataPacket[][]>(queryBuilder)

    return res.Success ? { Success: true, Value: res.Value[0] || null } : res
  }

  public async NewRow(queryBuilder: string|Error): Promise<DbResult<NewRowRes>> {
    const res = await this.executeCmd<mysql.OkPacket>(queryBuilder)

    return res.Success
      ? {
        Success: true,
        Value: {
          CreationDate: Utils.DatetimeToString(new Date()),
          NewId: res.Value.insertId,
        },
      }
      : (res as DbErrorResult)
  }

  /**
   * When not updating or inserting rows, should not evaluate `DbResult.Value`,
   * since it might not be equals `true`
   * @param queryBuilder
   */
  public async Execute(queryBuilder: string|Error): Promise<DbResult<boolean>> {
    const res = await this.executeCmd<mysql.OkPacket>(queryBuilder)

    return res.Success
      ? {
        Success: true,
        Value: !!res.Value.affectedRows || !res.Value.warningCount && !(res.Value as any).warningStatus,
      }
      : (res as DbErrorResult)
  }

  public async List(queryBuilder: string|Error): Promise<DbResult<DbRow[]>> {
    const res = await this.executeCmd<RowDataPacket[][]>(queryBuilder)

    return res
  }

  public async *StreamList(queryBuilder: string|Error, bufferSize = MyDb.STREAM_BUFFER_SIZE): MyAsyncGenerator<DbRow[]> {
    const sqlCmd = queryBuilder

    if (sqlCmd instanceof Error) {
      return undefined
    }
    console.log(sqlCmd)
    const conn = mysql.createConnection(this.connOptions)
    type Load = { done: () => void, finished: boolean, row?: RowDataPacket }
    let buffer: DbRow[] = []
    let finished = false
    let resolve: (load: Load) => void
    let promise = new Promise<Load>((res) => { resolve = res })

    const trans = (row: RowDataPacket, enc: string, done: (err?: Error | null) => void) => {
      resolve({ done, finished: false, row })
    }
    const flush = (done: (err?: Error | null, data?: any) => void) => {
      resolve({ done, finished: true })
    }

    const transform = new Transform({
      flush,
      objectMode: true,
      transform: trans,
    })

    const stream = conn.query(sqlCmd)
      .on("error", (err: Error) => {
        finished = true
      })
      .stream({ highWaterMark: (bufferSize + 12) })
      .pipe(transform)
      .on("error", (err: Error) => {
        finished = true
      })

    conn.end()

    while (!finished) {
      const { done, finished: fin, row } = await promise
      finished = fin

      if (finished) {
        buffer.length ? yield buffer : void
        done()
        break
      }
      let req: NextRequest
      buffer.push(row as DbRow)

      if (buffer.length >= bufferSize) {
        req = yield buffer
        buffer = []
      }
      if (req !== undefined) {
        if (req.abort) {
          stream.end()
          break
        }
        await req.waitFor
      }
      promise = new Promise<Load>((res) => { resolve = res })
      done()
    }
  }

  private async executeCmd<T extends CmdResult>(queryBuilder: string|Error): Promise<DbResult<T>> {
    let conn: mysqlAsync.Connection|null = null

    try {
      const sqlCmd = queryBuilder

      if (sqlCmd instanceof Error) {
        throw sqlCmd
      }
      console.log(sqlCmd)
      conn = await mysqlAsync.createConnection(this.connOptions)

      const [rows] = await conn.execute<T>(sqlCmd)
      conn.end()

      return { Success: true, Value: rows }
    }
    catch (e) {
      !conn || conn.end()
      return { Success: false, ErrorMsg: String(e) }
    }
  }
}
