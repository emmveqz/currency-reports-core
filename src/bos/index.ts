
import BaseBoEnum from "@emmveqz/currency-reports-core-enums/dist/BaseBoEnum"
import { IBaseBoFactory } from "@emmveqz/currency-reports-core-interfaces/dist/IBaseBo"
import AlertSuscription from "./AlertSuscription"
import CurrencyRateTick from "./CurrencyRateTick"

export { default } from "./BaseBo"
export * from "./AlertSuscription"
export * from "./CurrencyRateTick"
export * from "./IncrementalIdBo"
export * from "./UserAction"

//

export const GetBaseBoFactory = (boEnum: BaseBoEnum): IBaseBoFactory|Error => {
  switch (boEnum) {
    case BaseBoEnum.AlertSuscription:
      return AlertSuscription
    case BaseBoEnum.CurrencyRateTick:
      return CurrencyRateTick
    default:
      return new Error("Entity not found or not implemented.")
  }
}
