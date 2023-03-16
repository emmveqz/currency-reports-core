
import * as Decorator from "@emmveqz/currency-reports-core-interfaces/dist/Decorator"
import { EscapeString } from "@emmveqz/currency-reports-tools/dist/Validator"
import config from "../config/my-config-vars"

import BaseBo from "../bos"

import {
  BoPropVal,
  IBaseBo,
  IBaseBoFactory,
  IBaseDao,
  IQueryBuilder,
  ISqlCol,
  OrderBy,
  Page,
  QryClause,
  SqlCond,
  SqlJsVal,
  SqlOptr,
} from "@emmveqz/currency-reports-core-interfaces"

export default class BoQueryBuilder implements IQueryBuilder<IBaseBo, IBaseBoFactory> {
  public static readonly INITIAL_AUTOINCREMENT_ENTITY		= 1001
  public static readonly INITIAL_AUTOINCREMENT_PROPERTY	= 10001
  public static readonly INITIAL_AUTOINCREMENT_DDI		= 100001
  public static readonly INITIAL_AUTOINCREMENT_PAGEGROUP	= 1001
  public static readonly INITIAL_AUTOINCREMENT_PAGE		= 10001

  public static readonly MAX_ID							= 4294000000
  public static readonly GUIDS_START_AT					= 1000000000
  public static readonly RESERVED_IDS_SIZE				= 1000000000
  public static readonly DEFAULT_PAGE: Page = { Page: 1, Size: 10 }

  public static JsToSqlVal(jsVal: SqlJsVal, optr: SqlOptr): string | number {
    let start
    let end

    switch (optr) {
      case SqlOptr.Contain:
        start = "'%"
        end = "%'"
        break
      case SqlOptr.BeginWith:
        start = "'"
        end = "%'"
        break
      case SqlOptr.EndWith:
        start = "'%"
        end = "'"
        break
      default:
        start = typeof jsVal[0] === typeof "" ? "'" : ""
        end = typeof jsVal[0] === typeof "" ? "'" : ""
        break
    }
    if (optr === SqlOptr.In) {
      return `( ${Array.isArray(jsVal)
        ? jsVal.map( (val) => BoQueryBuilder.JsToSqlVal([val], SqlOptr.Equal) ).join(", ")
        : "''" } )`
    }
    if (typeof jsVal[0] === typeof "" || typeof jsVal[0] === typeof 1) {
      return `${start}${EscapeString( String(jsVal[0]) )}${end}`
    }
    if (typeof jsVal[0] === typeof true) {
      return !jsVal[0] ? 0 : 1
    }
    return "''"
  }

  public static SqlOptrToStr(optr: SqlOptr, not?: boolean): string {
    switch (optr) {
      case SqlOptr.Contain:
      case SqlOptr.BeginWith:
      case SqlOptr.EndWith:
        return `${not ? "NOT " : ""}LIKE`
      case SqlOptr.Greater:
        return ">"
      case SqlOptr.Less:
        return "<"
      case SqlOptr.Different:
        return "!="
      case SqlOptr.In:
        return `${not ? "NOT " : ""}IN`
      default:
        return "="
    }
  }

  public static GetUniqueColsCmd(bo: IBaseBo): { sql: string, fields: string }|null {
    const uniqueProps = Object.keys(bo)
      .filter( (prop) => BaseBo.IsPropValValid(bo[prop as keyof IBaseBo]) && Decorator.HasDecorator(Decorator.Db.UniqueKey, bo, prop) )

    const uniqueUnionProps = Object.keys(bo)
      .filter( (prop) => BaseBo.IsPropValValid(bo[prop as keyof IBaseBo]) && Decorator.HasDecorator(Decorator.Db.UniqueUnionKey, bo, prop) )

    if (!uniqueProps.length && !uniqueUnionProps.length) {
      return null
    }
    const uniqClause = uniqueProps.map((prop) => `\`${prop}\` = ${this.sanitizeVal(bo[prop as keyof IBaseBo] as BoPropVal)}`).join(" OR ")
    let uniqUnionClause = ""

    if (uniqueUnionProps.length) {
      uniqUnionClause = (uniqClause.length ? " OR " : "")
        + "(" +  uniqueUnionProps.map( (prop) => `\`${prop}\` = ${this.sanitizeVal(bo[prop as keyof IBaseBo] as BoPropVal)}` ).join(" AND ") + ")"
    }

    const tbl = bo.GetEntityName()
    bo.Id = Number.isInteger(bo.Id) ? bo.Id : 0
    const sql = `SELECT COUNT(*) AS count FROM ${tbl} WHERE Id != '${bo.Id}' AND (${uniqClause} ${uniqUnionClause})`
    const fields = uniqueProps.concat(uniqueUnionProps).join(", ")

    return { sql, fields }
  }

  public static buildWhereClause(qry: QryClause, bo: IBaseBo, dynProps?: IBaseBo[]): string {
    const props = Object.keys(bo.NewEmptyOrig())
      .filter( (prop) => !Decorator.HasDecorator(Decorator.Db.IsVirtualKey, bo, prop) )
    return this.buildClause(qry, props)
  }

  protected static buildClause(cls: QryClause, props: string[]): string {
    if (!cls.Prop || !props.includes(cls.Prop) || !cls.Val?.length) {
      return " 0 "
    }
    const res =
      ` \`${cls.Prop}\` ${BoQueryBuilder.SqlOptrToStr(cls.Optr, cls.NotOptr)} ${BoQueryBuilder.JsToSqlVal(cls.Val, cls.Optr)} `

    if (cls.InnerClsCond !== undefined && cls.RightClauses.length) {
      const clss = cls.RightClauses
        .map((rcls, idx, arr) => {
          return `${BoQueryBuilder.buildClause(rcls, props)} ${rcls.NextClsCond !== undefined && arr[idx + 1]
            ? SqlCond[rcls.NextClsCond] : ""} `
        })
        .join("")
      return `${res} ${SqlCond[cls.InnerClsCond]} (${clss})`
    }
    return res
  }

  protected static getSystemLockedClause(bo: IBaseBo, dynProps?: IBaseBo[]): string {
    const isSystemLockedProp = Object.keys(bo)
      .find( (prop) => Decorator.HasDecorator(Decorator.Db.MakesClassSysLockableKey, bo, prop) )

    return !isSystemLockedProp ? "" : `AND !${isSystemLockedProp}`
  }

  /**
   * Output is enclosed in single quotes ('') if `val` is a string.
   */
  protected static sanitizeVal(val: BoPropVal, typeDao?: IBaseDao, dynProp?: IBaseBo): string {
    return !BaseBo.IsPropValValid(val)
      ? `''`
      : (val === null
        ? `null`
        : ( (typeof val) === (typeof true)
          ? (!val ? `0` : `1`)
          : `'${EscapeString( val.toString() )}'`
        )
      )
  }

  protected static getCustomSqlCol(col: string) {
    // Keep adding rules such as the `COUNT()` that could be possible queried.
    // We'll need 3 groups in the RegEx  (1: start) (2: prop) (3: end)

    const custom = col.trim().match(/^(COUNT\()([A-Z]+)(\))$/i)

    return !custom ? undefined : { start: custom[1], prop: custom[2], end: custom[3] }
  }

  protected static buildColumns(validProps: string[], columns?: ISqlCol[]) {
    if (!columns || !columns.length) {
      return "*"
    }
    if (columns.length === 1 && columns[0].col === "*") {
      const cleanAlias = !columns[0].alias ? undefined : String(columns[0].alias).replace(/[^A-Z]/ig, "")

      return "*" + (cleanAlias ? ` AS \`${cleanAlias}\`` : "")
    }

    return columns
      .filter(({ col }) => {
        if (!col || typeof col !== typeof "") {
          return false
        }
        if ( validProps.includes(col) ) {
          return true
        }

        const custom = this.getCustomSqlCol(col)

        return !!custom && validProps.includes(custom.prop)
      })
      .map(({ alias, col }) => {
        const cleanAlias = !alias ? undefined : String(alias).replace(/[^A-Z]/ig, "")

        if ( validProps.includes(col) ) {
          return `\`${col}\` ${cleanAlias ? `AS \`${cleanAlias}\`` : ""}`
        }

        // It should be present since we filtered it out.
        const custom = this.getCustomSqlCol(col)

        return `${custom?.start}\`${custom?.prop}\`${custom?.end} ${cleanAlias ? `AS \`${cleanAlias}\`` : ""}`
      })
      .join(", ")
  }

  /**
   * @Note Adding `as typeof BoQueryBuilder` only for intellisense purpose, but it could be any child class.
   */
  protected selfClass = this.constructor as typeof BoQueryBuilder
  protected sqlCmd: string|Error = ""
  private orderByCmd: string = ""
  private columnsCmd: string = ""
  private skipOrderBy: boolean = false
  private limitCmd: string = ""

  constructor(public schema: string, public orderBy: OrderBy = { Prop: "" }, public page?: Page) {
  }

  public GetSqlCmd(): string|Error {
    return this.sqlCmd
  }

  public SetPaging(page: Page): this {
    this.page = page
    return this
  }

  /**
   * @param skip Defaults `true`
   */
  public SkipOrder(skip: boolean = true): this {
    this.skipOrderBy = !!skip
    return this
  }

  public BuildGetNewGuidCmd(factory: IBaseBoFactory): this {
    const tbl = factory.CreateNew().GetEntityName()
    const maxGuidId = this.selfClass.MAX_ID - (this.selfClass.GUIDS_START_AT + this.selfClass.RESERVED_IDS_SIZE)

    this.sqlCmd =
      `SELECT FLOOR(${this.selfClass.GUIDS_START_AT} + RAND() * ${maxGuidId}) AS guid FROM \`${tbl}\` ` +
      `WHERE "guid" NOT IN (SELECT Id FROM \`${tbl}\`) LIMIT 1`

    return this
  }

  /**
   * @assumes `id` is sanitized.
   */
  public BuildGetCmd(id: number, factory: IBaseBoFactory, columns?: ISqlCol[], dynProps?: IBaseBo[]): this {
    const bo = factory.CreateNew()

    this
      .setColumns(bo, columns, dynProps)
      .sqlCmd = `SELECT ${this.columnsCmd} FROM \`${bo.GetEntityName()}\` WHERE Id = ${id}`

    return this
  }

  public BuildListCmd(factory: IBaseBoFactory, columns?: ISqlCol[], qry?: QryClause, propsFromBo?: IBaseBo, dynProps?: IBaseBo[]): this {
    const bo = !propsFromBo ? factory.CreateNew() : propsFromBo
    const clause = !qry ? "" : `WHERE ${this.selfClass.buildWhereClause(qry, bo, dynProps)}`

    this
      .setColumns(bo, columns, dynProps)
      .setOrderBy(bo, dynProps)
      .setLimitCmd()
      .sqlCmd =
        `SELECT ${this.columnsCmd} FROM \`${bo.GetEntityName()}\` ${clause} ${this.orderByCmd} ${this.limitCmd}`

    return this
  }

  public BuildCreateCmd(bo: IBaseBo, dynProps?: IBaseBo[]): this {
    if ( !this.assertMandatoryValues(bo) ) {
      return this
    }
    const values: string[] = []

    const colStr = Object.keys(bo.NewEmptyOrig()).filter((prop) => {
      return !Decorator.HasDecorator(Decorator.Db.IsNonInsertableKey, bo, prop)
        && !Decorator.HasDecorator(Decorator.Db.IsVirtualKey, bo, prop)
        && BaseBo.IsPropValValid(bo[prop as keyof IBaseBo])
    })
    .map((prop) => {
      values.push( this.selfClass.sanitizeVal(bo[prop as keyof IBaseBo] as BoPropVal) )

      return `\`${prop}\``
    })
    .join(", ")

    const valStr = values.join(", ")

    this.sqlCmd = `INSERT INTO \`${bo.GetEntityName()}\`(${colStr}) VALUES(${valStr})`

    return this
  }

  public BuildUpdateCmd(bo: IBaseBo, dynProps?: IBaseBo[], avoidSystemLocked?: boolean): this {
    if ( !this.assertMandatoryValues(bo) ) {
      return this
    }
    const values = Object.keys(bo.NewEmptyOrig()).filter((prop) => {
      return !Decorator.HasDecorator(Decorator.Db.IsNonUpdatableKey, bo, prop)
        && !Decorator.HasDecorator(Decorator.Db.IsVirtualKey, bo, prop)
        && bo[prop as keyof IBaseBo] !== undefined
    })
    .map((prop) => {
      const val = this.selfClass.sanitizeVal(bo[prop as keyof IBaseBo] as BoPropVal)
      return `\`${prop}\` = ${val}`
    })
    .join(", ")

    const sysLockClause = avoidSystemLocked ? "" : this.selfClass.getSystemLockedClause(bo)

    bo.Id = Number.isInteger(bo.Id) ? bo.Id : 0
    this.sqlCmd = `UPDATE \`${bo.GetEntityName()}\` SET ${values} WHERE Id = ${bo.Id} ${sysLockClause}`

    return this
  }

  public BuildDeleteCmd<T extends { qry: QryClause, propsFromBo?: IBaseBo }>(idOrQry: number|T, factory: IBaseBoFactory, dynProps?: IBaseBo[], avoidSystemLocked?: boolean): this {
    let bo: IBaseBo
    let clause: string

    if (typeof idOrQry === typeof 1) {
      bo = factory.CreateNew()
      clause = `Id = ${idOrQry}`
    }
    else {
      bo = (idOrQry as T).propsFromBo || factory.CreateNew()
      clause = this.selfClass.buildWhereClause((idOrQry as T).qry, bo, dynProps)
    }
    /**
     * @todo THERE IS A WAY TO DO THIS A BIT FANCIER (COMPLEX), BUT WE WANT PERFORMANCE.
     * (SEE IMPLEMENTATION AT BaseDao.Update)
     */
    const sysLockClause = avoidSystemLocked ? "" : this.selfClass.getSystemLockedClause(bo, dynProps)

    this.sqlCmd = `DELETE FROM \`${bo.GetEntityName()}\` WHERE ${clause} ${sysLockClause}`

    return this
  }

  protected assertMandatoryValues(bo: IBaseBo): boolean {
    const emptyMandatory = Object.keys(bo).filter((prop) => {
      return !bo[prop as keyof IBaseBo] &&
        Decorator.HasDecorator(Decorator.Db.MandatoryKey, bo, prop) &&
        !Decorator.HasDecorator(Decorator.Db.IsVirtualKey, bo, prop)
    })
    if (emptyMandatory.length) {
      this.sqlCmd = new Error(`Empty value(s) for '${emptyMandatory.join(`', '`)}' is not allowed.`)
      return false
    }
    return true
  }

  /**
   * @assumes That Bo.Props names are sanitized.
   */
  protected setOrderBy(bo: IBaseBo, dynProps?: IBaseBo[]): this {
    if (this.skipOrderBy) {
      this.orderByCmd = ""
      return this
    }
    if (!this.orderBy.Prop) {
      const pKey = Object.keys(bo).find((prop) => {
        return Decorator.HasDecorator(Decorator.Db.DefaultOrderByKey, bo, prop)
      })
      this.orderBy = { Prop: pKey || "", Desc: true }
    }

    this.orderByCmd = this.orderBy.Prop.length && Object.keys(bo.NewEmptyOrig()).includes(this.orderBy.Prop)
      ? `ORDER BY \`${this.orderBy.Prop}\` ${this.orderBy.Desc ? "DESC" : "ASC"}`
      : ""

    return this
  }

  protected setOrderByCmd(orderByCmd: string): this {
    this.orderByCmd = orderByCmd
    return this
  }

  protected setColumns(bo: IBaseBo, columns?: ISqlCol[], dynProps?: IBaseBo[]): this {
    const validProps = Object.keys(bo.NewEmptyOrig())

    this.columnsCmd = this.selfClass.buildColumns(validProps, columns)
    return this
  }

  protected setColumnsCmd(columnsCmd: string): this {
    this.columnsCmd = columnsCmd
    return this
  }

  private setLimitCmd(): this {
    if (!this.page) {
      this.limitCmd = ""
      return this
    }
    if (Number.isNaN(Number(this.page.Page)) || Number.isNaN( Number(this.page.Size)) ||
      this.page.Page < 1 || this.page.Size < 1) {
      this.page = BoQueryBuilder.DEFAULT_PAGE
    }

    this.limitCmd = `LIMIT ${(this.page.Page - 1) * this.page.Size}, ${Number(this.page.Size)}`
    return this
  }
}
