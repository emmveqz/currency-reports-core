
import CurrencyEnum from "@emmveqz/currency-reports-core-enums/dist/CurrencyEnum"
import * as Decorate from "@emmveqz/currency-reports-core-interfaces/dist/Decorator"
import IncrementalIdBo from "./IncrementalIdBo"

export class CurrencyRateTick extends IncrementalIdBo {

  @Decorate.Db.Mandatory
  @Decorate.Db.IsNonUpdatable
  public Currency: CurrencyEnum = 0

  @Decorate.Db.Mandatory
  @Decorate.Db.IsNonUpdatable
  public Rate: number = 0

  public Volume: number = 0

}

export default CurrencyRateTick
