
import * as Decorate from "@emmveqz/currency-reports-core-interfaces/dist/Decorator"
import IncrementalIdBo from "./IncrementalIdBo"

export class UserAction extends IncrementalIdBo {

  @Decorate.Db.Mandatory
  @Decorate.Db.IsNonUpdatable
  public UserIp: string = ""

  @Decorate.Db.Mandatory
  @Decorate.Db.IsNonUpdatable
  public Action: string = ""

  /**
   * The stringified params.
   */
  public Params: string = ""

  /**
   * The stringified result.
   */
  public Result: string = ""

  public Notes: string = ""

}

export default UserAction
