
import {
  CurrencyEnum,
  RateAlertBasisEnum,
  RateAlertTypeEnum,
} from "@emmveqz/currency-reports-core-enums"
import * as Decorate from "@emmveqz/currency-reports-core-interfaces/dist/Decorator"
import IncrementalIdBo from "./IncrementalIdBo"

export class AlertSuscription extends IncrementalIdBo {

  @Decorate.Db.Mandatory
  @Decorate.Db.IsNonUpdatable
  public Currency: CurrencyEnum = CurrencyEnum.None1

  @Decorate.Db.Mandatory
  public CurrentRate: number = 0

  /**
   * Max length: 80
   */
  @Decorate.Db.IsNonUpdatable
  public Email: string = ""

  @Decorate.Db.Mandatory
  @Decorate.Db.IsNonUpdatable
  public Basis: RateAlertBasisEnum = RateAlertBasisEnum.None3

  @Decorate.Db.Mandatory
  @Decorate.Db.IsNonUpdatable
  public Type: RateAlertTypeEnum = RateAlertTypeEnum.None4

  @Decorate.Db.Mandatory
  @Decorate.Db.IsNonUpdatable
  public Factor: number = 0

  /***
   * So if `Basis` = `RateAlertBasisEnum.Percentage`, we can trigger the alert repeatedly. Must be at least 1.
   **/
  public TimesToRepeat: number = 0

  public TimesToRemind: number = 0

  public LastAlertDate: string = "0000-00-00 00:00:00"

  /**
   * Max length: 24
   */
  @Decorate.Db.IsNonUpdatable
  public PhoneNumber: string = ""

  /**
   * Max length: 120
   */
  @Decorate.Db.IsNonUpdatable
  public Memo: string = ""

}

export default AlertSuscription
