
import {
  DbErrorResult,
  IAnyObj,
  IBaseBo,
  IBaseBoFactory,
  IBaseDao,
  IMyDb,
  ISqlCol,
  MyAsyncGenerator,
  OrderBy,
  Page,
  QryClause,
} from "@emmveqz/currency-reports-core-interfaces"
import BoQueryBuilder from "./BoQueryBuilder"

//

export default abstract class CommonDao<IQry extends BoQueryBuilder = BoQueryBuilder> implements IBaseDao {
  protected db: IMyDb
  protected qry: IQry

  constructor(db: IMyDb, orderBy?: OrderBy, page?: Page, qry?: IQry) {
    this.db = db
    this.qry = qry === undefined ? new BoQueryBuilder(undefined, orderBy, page) as IQry : qry
  }

  /**
   * @param skip Defaults `true`
   */
  public SkipOrder(skip: boolean = true): this {
    this.qry.SkipOrder(skip)
    return this
  }

  public ChangeDb(db: IMyDb): this {
    this.db = db
    return this
  }

  public setOrderBy(orderBy: OrderBy): this {
    this.qry.orderBy = orderBy
    return this
  }

  public setPaging(page: Page): this {
    this.qry.SetPaging(page)
    return this
  }

  public async GetNewGuid(factory: IBaseBoFactory): Promise<number|Error> {
    const bo = await this.db.Get( this.qry.BuildGetNewGuidCmd(factory).GetSqlCmd() )

    if (!bo.Success || bo.Value === null || bo.Value.guid === undefined) {
      return new Error("error occurred while generating new object")
    }
    return Number(bo.Value.guid)
  }

  public async GetIds<IBo extends IBaseBo>(factory: IBaseBoFactory<IBo>, qry: QryClause): Promise<number[]|Error> {
    const dynProps = await this.getDynProps(factory)

    if (dynProps instanceof Error) {
      return dynProps
    }

    const col = factory.getPropNames(factory).Id
    this.qry.SkipOrder(true).BuildListCmd(factory, [{ col }], qry, undefined, dynProps).SkipOrder(false)

    const res = await this.db.List( this.qry.GetSqlCmd() )

    if (!res.Success) {
      return new Error((res as DbErrorResult).ErrorMsg)
    }

    return res.Value.map((row) => row[col] as number)
  }

  public async Count<IBo extends IBaseBo>(factory: IBaseBoFactory<IBo>, qry?: QryClause): Promise<number|Error> {
    const dynProps = await this.getDynProps(factory)

    if (dynProps instanceof Error) {
      return dynProps
    }
    const alias			= "count"
    const col			= `COUNT(${factory.getPropNames(factory).Id})`
    const propsFromBo	= this.getPropsFromBo(factory, dynProps)

    this.qry.SkipOrder(true).BuildListCmd(factory, [{ alias, col }], qry, propsFromBo, dynProps).SkipOrder(false)

    const res = await this.db.Get( this.qry.GetSqlCmd() )

    if (!res.Success) {
      return new Error((res as DbErrorResult).ErrorMsg)
    }
    if (!res.Value) {
      return new Error("unexpected error trying to read DB")
    }
    return res.Value[alias] as number || 0
  }

  public async Get<IBo extends IBaseBo>(id: number, factory: IBaseBoFactory<IBo>, columns?: ISqlCol[]): Promise<IBo | null> {
    const dynProps = await this.getDynProps(factory)

    if (dynProps instanceof Error) {
      return null
    }

    const bo = await this.db.Get( this.qry.BuildGetCmd(id, factory, columns, dynProps).GetSqlCmd() )

    if (!bo.Success || bo.Value === null) {
      return null
    }

    return factory.Parse(bo.Value, dynProps)
  }

  public async Create<IBo extends IBaseBo>(bo: IBo): Promise<IBo|Error> {
    const dynProps = await this.getDynProps(bo.constructor as IBaseBoFactory)

    if (dynProps instanceof Error) {
      return dynProps
    }
    const assertDuplicate = await this.assertUniqueFields(bo, dynProps)

    if (assertDuplicate instanceof Error) {
      return assertDuplicate
    }
    const res = await this.db.NewRow( this.qry.BuildCreateCmd(bo, dynProps).GetSqlCmd() )

    if (!res.Success) {
      return new Error((res as DbErrorResult).ErrorMsg)
    }
    bo.Id			= res.Value.NewId
    bo.CreationDate	= res.Value.CreationDate

    return bo
  }

  public async Update(bo: IBaseBo, avoidSystemLocked?: boolean): Promise<boolean|Error> {
    const dynProps = await this.getDynProps(bo.constructor as IBaseBoFactory)

    if (dynProps instanceof Error) {
      return dynProps
    }
    const assertDuplicate = await this.assertUniqueFields(bo, dynProps)

    if (assertDuplicate instanceof Error) {
      return assertDuplicate
    }
    if ( !avoidSystemLocked && await this.isSystemLockedBo(bo, dynProps) ) {
      return new Error("You cannot make changes to a System Locked object.")
    }

    const res = await this.db.Execute( this.qry.BuildUpdateCmd(bo, dynProps, avoidSystemLocked).GetSqlCmd() )

    return res.Success ? res.Value : new Error((res as DbErrorResult).ErrorMsg)
  }

  public async Delete(id: number, factory: IBaseBoFactory, avoidSystemLocked?: boolean): Promise<boolean|Error> {
    const dynProps = await this.getDynProps(factory)

    if (dynProps instanceof Error) {
      return dynProps
    }
    const bo = await this.Get(id, factory)

    if (!bo) {
      return true
    }
    if ( !avoidSystemLocked && await this.isSystemLockedBo(bo, dynProps, true) ) {
      return new Error("You cannot delete a System Locked object.")
    }
    const res = await this.db.Execute( this.qry.BuildDeleteCmd(id, factory, dynProps, avoidSystemLocked).GetSqlCmd() )

    return res.Success ? res.Value : new Error((res as DbErrorResult).ErrorMsg)
  }

  public async DeleteQuery(qry: QryClause, factory: IBaseBoFactory, avoidSystemLocked?: boolean): Promise<boolean|Error> {
    const dynProps = await this.getDynProps(factory)

    if (dynProps instanceof Error) {
      return dynProps
    }

    const systemLocked = avoidSystemLocked ? false : await this.areSystemLockedBos(qry, factory, dynProps)

    if (systemLocked instanceof Error) {
      return systemLocked
    }
    if (systemLocked) {
      return new Error("You cannot delete System Locked objects.")
    }

    const propsFromBo	= this.getPropsFromBo(factory, dynProps)
    const res			= await this.db.Execute( this.qry.BuildDeleteCmd({ qry, propsFromBo }, factory, dynProps, avoidSystemLocked).GetSqlCmd() )

    return res.Success ? res.Value : new Error((res as DbErrorResult).ErrorMsg)
  }

  public async List<IBo extends IBaseBo>(factory: IBaseBoFactory<IBo>, columns?: ISqlCol[]): Promise<IBo[]|Error> {
    const dynProps = await this.getDynProps(factory)

    if (dynProps instanceof Error) {
      return dynProps
    }

    const propsFromBo	= this.getPropsFromBo(factory, dynProps)
    const list			= await this.db.List( this.qry.BuildListCmd(factory, columns, undefined, propsFromBo, dynProps).GetSqlCmd() )

    if (!list.Success) {
      return new Error((list as DbErrorResult).ErrorMsg)
    }

    /**
     * @note Watch for this, if Parsing is actually needed
     * since it could affect on performance
     */
    return factory.ParseList(list.Value, dynProps)
  }

  public async Query<IBo extends IBaseBo>(qry: QryClause, factory: IBaseBoFactory<IBo>, columns?: ISqlCol[]): Promise<IBo[]|Error> {
    const dynProps = await this.getDynProps(factory)

    if (dynProps instanceof Error) {
      return dynProps
    }

    const propsFromBo	= this.getPropsFromBo(factory, dynProps)
    const list			= await this.db.List( this.qry.BuildListCmd(factory, columns, qry, propsFromBo, dynProps).GetSqlCmd() )

    if (!list.Success) {
      return new Error((list as DbErrorResult).ErrorMsg)
    }

    /**
     * @note Watch for this, if Parsing is actually needed
     * since it could affect on performance
     */
    return factory.ParseList(list.Value, dynProps)
  }

  public async *StreamQuery<IBo extends IBaseBo>(qry: QryClause, factory: IBaseBoFactory<IBo>, bufferSize?: number, columns?: ISqlCol[]): MyAsyncGenerator<IBo[]> {
    const dynProps = await this.getDynProps(factory)

    if (dynProps instanceof Error) {
      return
    }

    const propsFromBo	= this.getPropsFromBo(factory, dynProps)
    const gentr			= this.db.StreamList(this.qry.BuildListCmd(factory, columns, qry, propsFromBo, dynProps).GetSqlCmd(), bufferSize)
    let itr				= await gentr.next()

    while (!itr.done) {
      /**
       * @note Watch for this, if Parsing is actually needed
       * since it could affect on performance
       */
      const req = yield factory.ParseList(itr.value as IAnyObj[], dynProps)
      itr = await gentr.next(req)
    }
  }

  public async *StreamList<IBo extends IBaseBo>(factory: IBaseBoFactory<IBo>, bufferSize?: number, columns?: ISqlCol[]): MyAsyncGenerator<IBo[]> {
    const dynProps = await this.getDynProps(factory)

    if (dynProps instanceof Error) {
      return
    }

    const propsFromBo	= this.getPropsFromBo(factory, dynProps)
    const gentr			= this.db.StreamList(this.qry.BuildListCmd(factory, columns, undefined, propsFromBo, dynProps).GetSqlCmd(), bufferSize)
    let itr				= await gentr.next()

    while (!itr.done) {
      /**
       * @note Watch for this, if Parsing is actually needed
       * since it could affect on performance
       */
      const req = yield factory.ParseList(itr.value as IAnyObj[], dynProps)
      itr = await gentr.next(req)
    }
  }

  public async *StreamGetIds<IBo extends IBaseBo>(qry: QryClause, factory: IBaseBoFactory<IBo>, bufferSize?: number): MyAsyncGenerator<number[]> {
    const dynProps = await this.getDynProps(factory)

    if (dynProps instanceof Error) {
      return
    }

    const col			= factory.getPropNames(factory).Id
    const propsFromBo	= this.getPropsFromBo(factory, dynProps)

    this.qry.SkipOrder().BuildListCmd(factory, [{ col }], qry, propsFromBo, dynProps).SkipOrder(false)

    const gentr	= this.db.StreamList(this.qry.GetSqlCmd(), bufferSize)
    let itr		= await gentr.next()

    while (!itr.done) {
      const req = yield (itr.value as IAnyObj[]).map((row) => row[col] as number)
      itr = await gentr.next(req)
    }
  }

  public abstract getDynProps<IBo extends IBaseBo>(factory: IBaseBoFactory<IBo>): Promise<IBaseBo[]|Error>

  protected abstract getPropsFromBo<IBo extends IBaseBo>(factory: IBaseBoFactory<IBo>, dynProps: IBaseBo[]): IBo|undefined

  protected abstract isSystemLockedBo(bo: IBaseBo, dynProps: IBaseBo[], skipFetchingOldBo?: boolean): Promise<boolean>

  protected abstract areSystemLockedBos(qry: QryClause, factory: IBaseBoFactory, dynProps: IBaseBo[]): Promise<boolean|Error>

  protected abstract assertUniqueFields(bo: IBaseBo, dynProps: IBaseBo[]): Promise<true|Error>

}
