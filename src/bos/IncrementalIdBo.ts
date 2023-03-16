
import * as Decorate from "@emmveqz/currency-reports-core-interfaces/dist/Decorator"
import IBaseBo from "@emmveqz/currency-reports-core-interfaces/dist/IBaseBo"
import BaseBo from "./BaseBo"

export class IncrementalIdBo extends BaseBo {

  @Decorate.Db.IsNonInsertable
  public Id: number = 0

}

export default IncrementalIdBo
