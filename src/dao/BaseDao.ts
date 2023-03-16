
import * as Decorator from "@emmveqz/currency-reports-core-interfaces/dist/Decorator"

import {
  DbErrorResult,
  IBaseBo,
  IBaseBoFactory,
  QryClause,
  SqlCond,
  SqlOptr,
} from "@emmveqz/currency-reports-core-interfaces"
import BoQueryBuilder from "./BoQueryBuilder"
import CommonDao from "./CommonDao"

//

export default class BaseDao<IQry extends BoQueryBuilder = BoQueryBuilder> extends CommonDao<IQry> {

  public async getDynProps<IBo extends IBaseBo>(factory: IBaseBoFactory<IBo>): Promise<IBaseBo[]|Error> {
    return []
  }

  protected async assertUniqueFields(bo: IBaseBo, dynProps: IBaseBo[]): Promise<true|Error> {
    const cmd = BoQueryBuilder.GetUniqueColsCmd(bo)

    if (!cmd) {
      return true
    }
    const list = await this.db.List(cmd.sql)

    if (!list.Success) {
      return new Error((list as DbErrorResult).ErrorMsg)
    }

    const repeated = list.Value.length && list.Value[0].count ? cmd.fields : false

    return !repeated ? true : new Error(`Cannot duplicate values for the following fields: ${repeated}`)
  }

  protected async isSystemLockedBo(bo: IBaseBo, dynProps: IBaseBo[], skipFetchingOldBo?: boolean): Promise<boolean> {
    const isSystemLockedProp = Object.keys(bo)
      .find( (prop) => Decorator.HasDecorator(Decorator.Db.MakesClassSysLockableKey, bo, prop) )

    if (!!isSystemLockedProp) {
      const oldBo = skipFetchingOldBo ? bo : await this.Get(bo.Id, bo.constructor as IBaseBoFactory)

      return !!oldBo && !!oldBo[isSystemLockedProp as keyof IBaseBo]
    }
    return false
  }

  protected getPropsFromBo<IBo extends IBaseBo>(): IBo|undefined {
    return undefined
  }

  protected async areSystemLockedBos(qry: QryClause, factory: IBaseBoFactory): Promise<boolean|Error> {
    const sampleBo = factory.CreateNew()
    const systemLockedProp = Object
      .keys(sampleBo)
      .find( (prop) => Decorator.HasDecorator(Decorator.Db.MakesClassSysLockableKey, sampleBo, prop) )

    if (!systemLockedProp) {
      return true
    }

    const newQry: QryClause = {
      Prop:	systemLockedProp,
      Optr:	SqlOptr.Equal,
      Val:	[true],
      InnerClsCond:	SqlCond.AND,
      RightClauses:	[qry],
    }

    const count = await this.Count(factory, newQry)
    return count instanceof Error ? count : count > 0
  }

}
